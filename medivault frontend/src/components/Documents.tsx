import { FileText, Upload, Search, Download, Share2, Filter } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useState, useRef, ChangeEvent } from 'react';

interface DocumentsProps {
  onNavigate: (page: string) => void;
}

export function Documents({ onNavigate }: DocumentsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploading(true);
      setUploadStatus('Uploading...');

      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch('http://localhost:8000/upload', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Upload success:', data);
          setUploadStatus(`Uploaded: ${file.name}`);
        } else {
          console.error('Upload failed');
          setUploadStatus('Upload failed. Please try again.');
        }
      } catch (error) {
        console.error('Error uploading file:', error);
        setUploadStatus('Error uploading file. Is the backend running?');
      } finally {
        setUploading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="bg-white p-4 border-b border-gray-200">
          <h1 className="mb-4">Medical Documents</h1>
          
          {/* Profile Selector */}
          <Select defaultValue="self">
            <SelectTrigger className="w-full mb-3">
              <SelectValue placeholder="Select profile" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="self">Tanishka (Self)</SelectItem>
              <SelectItem value="sister">Shruti (Sister)</SelectItem>
              <SelectItem value="mother">Trisha (Mother)</SelectItem>
            </SelectContent>
          </Select>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input 
              placeholder="Search documents..."
              className="pl-10"
            />
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Upload Area */}
          <Card className="p-6 border-2 border-dashed border-gray-300 text-center">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept=".pdf,.jpg,.jpeg,.png"
            />
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <div className="mb-2">Upload Medical Documents</div>
            <div className="text-gray-500 mb-4">PDF, JPG, PNG up to 10MB</div>
            <Button className="w-full" onClick={handleUploadClick} disabled={uploading}>
              {uploading ? 'Uploading...' : 'Choose File'}
            </Button>
            {uploadStatus && (
              <div className={`mt-2 text-sm ${uploadStatus.includes('Error') || uploadStatus.includes('failed') ? 'text-red-500' : 'text-green-600'}`}>
                {uploadStatus}
              </div>
            )}
          </Card>

          {/* Document Type Filter */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-5 h-5 text-gray-500" />
              <div>Filter by Type</div>
            </div>
            <Select defaultValue="all">
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Documents</SelectItem>
                <SelectItem value="lab">Lab Reports</SelectItem>
                <SelectItem value="prescription">Prescriptions</SelectItem>
                <SelectItem value="imaging">Bills & Images</SelectItem>
                <SelectItem value="discharge">Discharge Summary</SelectItem>
                <SelectItem value="insurance">Insurance</SelectItem>
                <SelectItem value="vaccination">Vaccination Cards</SelectItem>
              </SelectContent>
            </Select>
          </Card>

          {/* Document Categories */}
          <div>
            <div className="mb-3">Document Categories</div>
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-sm mb-1">Lab Reports</div>
                <div className="text-gray-500">8 files</div>
              </Card>
              <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-2">
                  <FileText className="w-5 h-5 text-green-600" />
                </div>
                <div className="text-sm mb-1">Prescriptions</div>
                <div className="text-gray-500">5 files</div>
              </Card>
              <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-2">
                  <FileText className="w-5 h-5 text-purple-600" />
                </div>
                <div className="text-sm mb-1">Bills & Images</div>
                <div className="text-gray-500">3 files</div>
              </Card>
              <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mb-2">
                  <FileText className="w-5 h-5 text-orange-600" />
                </div>
                <div className="text-sm mb-1">Discharge</div>
                <div className="text-gray-500">2 files</div>
              </Card>
              <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mb-2">
                  <FileText className="w-5 h-5 text-red-600" />
                </div>
                <div className="text-sm mb-1">Insurance</div>
                <div className="text-gray-500">Plan: A</div>
              </Card>
              <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow">
                <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center mb-2">
                  <FileText className="w-5 h-5 text-teal-600" />
                </div>
                <div className="text-sm mb-1">Vaccination</div>
                <div className="text-gray-500">4 files</div>
              </Card>
            </div>
          </div>

          {/* Recent Documents */}
          <div>
            <div className="mb-3">Recent Documents</div>
            <div className="space-y-3">
              <Card className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-sm mb-1">Annual Blood Panel</div>
                      <div className="text-gray-500 text-xs">Lab Report</div>
                      <div className="text-gray-400 text-xs">2025-05-28</div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1">
                    <Download className="w-3 h-3 mr-1" />
                    View
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1">
                    <Share2 className="w-3 h-3 mr-1" />
                    Share
                  </Button>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <div className="text-sm mb-1">Medication Adjustment</div>
                      <div className="text-gray-500 text-xs">Prescription</div>
                      <div className="text-gray-400 text-xs">2025-04-15</div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1">
                    <Download className="w-3 h-3 mr-1" />
                    View
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1">
                    <Share2 className="w-3 h-3 mr-1" />
                    Share
                  </Button>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <div className="text-sm mb-1">X-Ray Report</div>
                      <div className="text-gray-500 text-xs">Imaging</div>
                      <div className="text-gray-400 text-xs">2025-01-12</div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1">
                    <Download className="w-3 h-3 mr-1" />
                    View
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1">
                    <Share2 className="w-3 h-3 mr-1" />
                    Share
                  </Button>
                </div>
              </Card>
            </div>
          </div>

          {/* AI Search Tip */}
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="mb-2">💡 AI-Powered Search</div>
            <div className="text-gray-600 text-sm">
              Try: "last diabetes report" or "MRI from 2023"
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
