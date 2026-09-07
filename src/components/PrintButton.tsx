'use client';

import { Printer } from "lucide-react";

interface PrintButtonProps {
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function PrintButton({ 
  label = "Descargar Audit PDF", 
  className,
  style 
}: PrintButtonProps) {
  return (
    <button 
      onClick={() => window.print()} 
      className={className || "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-lg text-sm font-semibold inline-flex items-center transition-colors print:hidden shadow-sm"}
      style={style}
      title="Descargar o imprimir reporte de auditoría estratégica en PDF"
    >
      <Printer className="h-4 w-4 mr-1.5 text-indigo-600" />
      {label}
    </button>
  );
}
