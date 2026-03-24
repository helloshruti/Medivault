# Medivault

This project consists of a FastAPI backend and a React (Vite) frontend.

## Prerequisites

- [Python](https://www.python.org/) (for the backend)
- [Node.js](https://nodejs.org/) (for the frontend)

## Getting Started

### 1. Setting up the Backend

1. Navigate to the backend directory:
   ```bash
   cd "medivault backend"
   ```

2. Create a virtual environment (optional but recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Run the server:
   ```bash
   uvicorn main:app --reload
   ```
   The backend will start at `http://localhost:8000`.

### 2. Setting up the Frontend

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd "medivault frontend"
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```
   The frontend will typically start at `http://localhost:5173`.

## Project Structure

- **medivault backend**: Contains the FastAPI application, data JSON files, and file upload storage.
- **medivault frontend**: Contains the React application built with Vite and Tailwind CSS.
- **medivault models**: Contains machine learning models (if applicable).
