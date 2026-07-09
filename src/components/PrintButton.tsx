'use client';

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button 
      onClick={() => window.print()} 
      className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-md text-sm font-medium inline-flex items-center transition-colors print:hidden"
    >
      <Printer className="h-4 w-4 mr-2" />
      Print PDF
    </button>
  );
}
