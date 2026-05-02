import { FileText, Upload, Search, Share2, Loader2, ExternalLink, Trash2, Image, FileCheck } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { useState, useRef, ChangeEvent, useEffect, useCallback } from 'react';
import { useProfile } from '../context/ProfileContext';
import { useAuth } from '../context/AuthContext';

interface DocumentsProps {
  onNavigate: (page: string) => void;
}

interface DocumentRecord {
  id: string;
  filename: string;
  doc_type: string;
  profile: string;
  cid: string;
  gateway_url: string;
  sha256: string;
  size: number;
  uploaded_at: string;
}

interface DocStats {
  lab: number;
  prescription: number;
  imaging: number;
  discharge: number;
  insurance: number;
  vaccination: number;
  unidentified: number;
  total: number;
}

const DOC_TYPE_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  lab: { label: 'Lab Report', color: 'text-blue-600', bgColor: 'bg-blue-50' },
  prescription: { label: 'Prescription', color: 'text-green-600', bgColor: 'bg-green-50' },
  imaging: { label: 'Bills & Images', color: 'text-purple-600', bgColor: 'bg-purple-50' },
  discharge: { label: 'Discharge', color: 'text-orange-600', bgColor: 'bg-orange-50' },
  insurance: { label: 'Insurance', color: 'text-red-600', bgColor: 'bg-red-50' },
  vaccination: { label: 'Vaccination', color: 'text-teal-600', bgColor: 'bg-teal-50' },
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function Documents({ onNavigate }: DocumentsProps) {
  const { profiles, selectedProfileId, setSelectedProfileId } = useProfile();
  const { user } = useAuth();
  const userEmail = encodeURIComponent(user?.email || '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [uploadDocType, setUploadDocType] = useState('auto');

  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [stats, setStats] = useState<DocStats>({ lab: 0, prescription: 0, imaging: 0, discharge: 0, insurance: 0, vaccination: 0, unidentified: 0, total: 0 });
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Fetch documents filtered by selected profile
  const fetchDocuments = useCallback(async () => {
    if (!selectedProfileId) return;
    try {
      const [docsRes, statsRes] = await Promise.all([
        fetch(`http://localhost:8000/documents?profile=${selectedProfileId}&user=${userEmail}`),
        fetch(`http://localhost:8000/documents/stats/summary?profile=${selectedProfileId}&user=${userEmail}`),
      ]);
      const docsData = await docsRes.json();
      const statsData = await statsRes.json();
      setDocuments(docsData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedProfileId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadStatus(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('doc_type', uploadDocType);
    formData.append('profile', selectedProfileId);
    formData.append('user', user?.email || '');

    try {
      const response = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        const detectedLabel = DOC_TYPE_CONFIG[data.doc_type]?.label || data.doc_type;
        const autoNote = data.auto_detected ? ` Detected as: ${detectedLabel}.` : '';
        const medsNote = data.extracted_medications?.length
          ? ` ${data.extracted_medications.length} medication(s) added to Meds tab.`
          : '';
        setUploadStatus({
          type: 'success',
          message: `"${file.name}" uploaded successfully.${autoNote}${medsNote}`
        });
        // Refresh document list
        fetchDocuments();
      } else {
        setUploadStatus({
          type: 'error',
          message: data.error || 'Upload failed. Please try again.'
        });
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      setUploadStatus({
        type: 'error',
        message: 'Error uploading file. Is the backend running?'
      });
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleReclassify = async (docId: string, newType: string) => {
    try {
      await fetch(`http://localhost:8000/documents/${docId}?user=${userEmail}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_type: newType }),
      });
      fetchDocuments();
    } catch (err) {
      console.error('Failed to reclassify document:', err);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm('Remove this document from your records?')) return;
    try {
      await fetch(`http://localhost:8000/documents/${docId}?user=${userEmail}`, { method: 'DELETE' });
      fetchDocuments();
    } catch (err) {
      console.error('Failed to delete document:', err);
    }
  };

  // Filter and search documents
  const filteredDocs = documents.filter(doc => {
    const matchesType = filterType === 'all' || doc.doc_type === filterType;
    const matchesSearch = !searchQuery ||
      doc.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (DOC_TYPE_CONFIG[doc.doc_type]?.label || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="bg-white p-4 border-b border-gray-200">
          <h1 className="mb-4">Medical Documents</h1>
          
          {/* Profile Selector */}
          <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
            <SelectTrigger className="w-full mb-3">
              <SelectValue placeholder="Select profile" />
            </SelectTrigger>
            <SelectContent>
              {profiles.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name} ({p.relation})</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input 
              placeholder="Search documents..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Upload Area */}
          <Card className="p-6 border-2 border-dashed border-gray-300">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept=".pdf,.jpg,.jpeg,.png"
            />
            <div className="text-center">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <div className="mb-2">Upload Medical Documents</div>
              <div className="text-gray-500 text-sm mb-3">PDF, JPG, PNG -- stored securely on IPFS via Pinata</div>
            </div>

            {/* Document type selector for upload */}
            <div className="mb-3">
              <label className="text-xs text-gray-500 mb-1 block">Document type</label>
              <Select value={uploadDocType} onValueChange={setUploadDocType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-detect (OCR)</SelectItem>
                  <SelectItem value="lab">Lab Report</SelectItem>
                  <SelectItem value="prescription">Prescription</SelectItem>
                  <SelectItem value="imaging">Bills & Images</SelectItem>
                  <SelectItem value="discharge">Discharge Summary</SelectItem>
                  <SelectItem value="insurance">Insurance</SelectItem>
                  <SelectItem value="vaccination">Vaccination Card</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button className="w-full" onClick={handleUploadClick} disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading to IPFS...
                </>
              ) : (
                'Choose File'
              )}
            </Button>

            {uploadStatus && (
              <div className={`mt-3 p-3 rounded-lg text-sm flex items-start gap-2 ${
                uploadStatus.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {uploadStatus.type === 'success' && <FileCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                <span>{uploadStatus.message}</span>
              </div>
            )}
          </Card>


          {/* Document Categories - Dynamic counts from backend */}
          <div>
            <div className="mb-3">Document Categories</div>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(DOC_TYPE_CONFIG).map(([key, config]) => (
                <Card
                  key={key}
                  className={`p-3 cursor-pointer hover:shadow-md transition-shadow ${filterType === key ? 'ring-2 ring-blue-400' : ''}`}
                  onClick={() => setFilterType(filterType === key ? 'all' : key)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 ${config.bgColor.replace('50', '100')} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      {key === 'imaging' ? (
                        <Image className={`w-4 h-4 ${config.color}`} />
                      ) : (
                        <FileText className={`w-4 h-4 ${config.color}`} />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{config.label}</div>
                      <div className="text-xs text-gray-500">
                        {(stats as Record<string, number>)[key] || 0} {((stats as Record<string, number>)[key] || 0) === 1 ? 'file' : 'files'}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}

              {/* View All tile */}
              <Card
                className={`p-3 cursor-pointer hover:shadow-md transition-shadow ${filterType === 'all' ? 'ring-2 ring-blue-400' : ''}`}
                onClick={() => setFilterType('all')}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">View All</div>
                    <div className="text-xs text-gray-500">{stats.total} {stats.total === 1 ? 'file' : 'files'}</div>
                  </div>
                </div>
              </Card>

              {/* Unidentified tile */}
              <Card
                className={`p-3 cursor-pointer hover:shadow-md transition-shadow ${filterType === 'unidentified' ? 'ring-2 ring-gray-400' : ''}`}
                onClick={() => setFilterType('unidentified')}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-yellow-600" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Unidentified</div>
                    <div className="text-xs text-gray-500">{stats.unidentified || 0} {(stats.unidentified || 0) === 1 ? 'file' : 'files'}</div>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Documents List - Real data from backend/Pinata */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>{filterType === 'all' ? 'All Documents' : filterType === 'unidentified' ? 'Unidentified' : DOC_TYPE_CONFIG[filterType]?.label || 'Documents'}</div>
              <Badge variant="secondary">{filteredDocs.length}</Badge>
            </div>

            {loading ? (
              <Card className="p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-gray-400" />
                <div className="text-gray-500 text-sm">Loading documents...</div>
              </Card>
            ) : filteredDocs.length === 0 ? (
              <Card className="p-8 text-center">
                <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <div className="text-gray-500 text-sm">
                  {searchQuery ? 'No documents match your search.' : 'No documents uploaded yet.'}
                </div>
                <div className="text-gray-400 text-xs mt-1">
                  Upload documents here or from the Meds tab (prescriptions).
                </div>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredDocs.map(doc => {
                  const typeConfig = DOC_TYPE_CONFIG[doc.doc_type] || { label: doc.doc_type, color: 'text-gray-600', bgColor: 'bg-gray-50' };
                  return (
                    <Card key={doc.id} className="p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`w-10 h-10 ${typeConfig.bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
                          <FileText className={`w-5 h-5 ${typeConfig.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate" title={doc.filename}>
                            {doc.filename}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="secondary" className="text-xs">
                              {typeConfig.label}
                            </Badge>
                            <span className="text-gray-400 text-xs">
                              {formatFileSize(doc.size)}
                            </span>
                          </div>
                          <div className="text-gray-400 text-xs mt-1">
                            {formatDate(doc.uploaded_at)}
                          </div>
                          <div className="text-gray-300 text-xs mt-0.5 font-mono truncate" title={doc.cid}>
                            CID: {doc.cid.slice(0, 20)}...
                          </div>
                        </div>
                      </div>
                      {doc.doc_type === 'unidentified' && (
                        <div className="mb-2">
                          <Select onValueChange={(value) => handleReclassify(doc.id, value)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Classify as..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="lab">Lab Report</SelectItem>
                              <SelectItem value="prescription">Prescription</SelectItem>
                              <SelectItem value="bills">Bills</SelectItem>
                              <SelectItem value="discharge">Discharge Summary</SelectItem>
                              <SelectItem value="insurance">Insurance</SelectItem>
                              <SelectItem value="vaccination">Vaccination</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            // Use the decryption proxy to view encrypted documents
                            const viewUrl = `http://localhost:8000/documents/${doc.id}/view?user=${userEmail}`;
                            window.open(viewUrl, '_blank');
                          }}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            const viewUrl = `http://localhost:8000/documents/${doc.id}/view?user=${userEmail}`;
                            navigator.clipboard.writeText(viewUrl);
                            alert('Document link copied to clipboard!');
                          }}
                        >
                          <Share2 className="w-3 h-3 mr-1" />
                          Share
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => handleDelete(doc.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Security Info */}
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="mb-2">Encrypted & Secure Storage</div>
            <div className="text-gray-600 text-sm">
              Your documents are encrypted with AES-256 before being stored on IPFS. Each file is hashed with SHA-256 for integrity verification. Only MediVault can decrypt and display your medical records.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
