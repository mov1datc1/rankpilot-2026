import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import prisma from "@/lib/prisma";
import { ChevronLeft, Download, Printer } from "lucide-react";
import Link from "next/link";


export default async function ReportDetail({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  let resolvedUserId = user.id;
  if (user.email) {
    const existingByEmail = await prisma.user.findUnique({ where: { email: user.email } });
    if (existingByEmail) {
      resolvedUserId = existingByEmail.id;
    }
  }

  const submission = await prisma.submission.findUnique({
    where: { id: params.id },
    include: { matters: true }
  });

  if (!submission || (submission.userId !== user.id && submission.userId !== resolvedUserId)) {
    redirect('/reports');
  }

  const chambersData = submission.chambersData as any || {};
  const analysis = chambersData.analysis || {};
  const context = chambersData.strategicContext || {};
  const letter = analysis.audit_letter || {};

  const score = analysis.score || 0;
  const riskLevel = analysis.risk_level || "Pending";
  const archetype = context.archetype || "Strategic model pending";
  const detectedTier = context.starting_position || "Not classified";
  const target = context.target_realistic || "Target pending";
  
  // Format Date
  const dateStr = submission.createdAt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-20">
      {/* Top Navigation */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center space-x-4">
          <Link href="/reports">
            <button className="text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-md text-sm font-medium inline-flex items-center transition-colors hover:bg-gray-100">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Reports
            </button>
          </Link>
          <div className="h-6 w-px bg-gray-200"></div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">RankPilot: Strategic Audit</h1>
            <p className="text-sm text-gray-500">{submission.targetDirectory} | {submission.practiceArea}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={() => window.print()} className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-md text-sm font-medium inline-flex items-center transition-colors">
            <Printer className="h-4 w-4 mr-2" />
            Print PDF
          </button>
          <a href={`/api/generate-docx?id=${submission.id}`} target="_blank" rel="noopener noreferrer">
            <button className="bg-[#1A237E] hover:bg-[#121858] text-white px-3 py-1.5 rounded-md text-sm font-medium inline-flex items-center transition-colors">
              <Download className="h-4 w-4 mr-2" />
              Download Submission DOCX
            </button>
          </a>
        </div>
      </div>

      <div className="max-w-5xl mx-auto w-full px-8 mt-8 space-y-6">
        
        {/* Top Metric Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Risk Level</h3>
            <p className={`text-xl font-semibold ${riskLevel === 'Low' ? 'text-green-600' : riskLevel === 'High' ? 'text-red-600' : 'text-amber-600'}`}>
              {riskLevel}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Archetype</h3>
            <p className="text-lg font-semibold text-gray-900 line-clamp-2">{archetype}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Detected Tier</h3>
            <p className="text-lg font-semibold text-gray-900">{detectedTier}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Target</h3>
            <p className="text-lg font-semibold text-[#1A237E]">{target}</p>
          </div>
        </div>

        {/* The Audit Letter Paper */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Header Line */}
          <div className="h-1 w-full bg-gradient-to-r from-amber-400 to-amber-500"></div>
          
          <div className="p-12">
            <div className="mb-10">
              <h2 className="text-3xl font-bold text-[#1A237E] mb-6">Strategic Audit Letter</h2>
              <div className="space-y-1 text-sm text-gray-600">
                <p><strong>To:</strong> The Board of Directors at the Firm</p>
                <p><strong>From:</strong> RankPilot Consulting</p>
                <p><strong>Date:</strong> {dateStr}</p>
              </div>
            </div>

            <div className="space-y-10 text-gray-800 leading-relaxed">
              
              {/* Executive Summary */}
              <div>
                <p className="text-lg text-gray-600 italic">
                  {analysis.summary || "Pending analysis generation."}
                </p>
              </div>

              {/* State of Play */}
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">The State of Play</h3>
                <p>{letter.the_state_of_play || "Pending."}</p>
              </div>

              {/* Unfair Advantage */}
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">The Unfair Advantage</h3>
                <p>{letter.the_unfair_advantage || "Pending."}</p>
              </div>

              {/* Reality Check */}
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-100">
                <h3 className="text-xl font-bold text-gray-900 mb-4">The Reality Check</h3>
                <p className="mb-4 text-gray-600">The submission is currently held back by avoidable defects:</p>
                <ul className="space-y-3">
                  {(letter.the_reality_check || []).map((point: string, i: number) => (
                    <li key={i} className="flex items-start">
                      <span className="text-amber-500 mr-2 mt-1">•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Path to Dominance */}
              <div>
                <h3 className="text-xl font-bold text-[#1A237E] mb-6">The Path to Dominance</h3>
                <div className="space-y-6">
                  {(letter.the_path_to_dominance || []).map((step: any, i: number) => (
                    <div key={i}>
                      <h4 className="font-bold text-gray-900 mb-2">STEP {i + 1}: {step.title}</h4>
                      <p className="text-gray-600">{step.description}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
