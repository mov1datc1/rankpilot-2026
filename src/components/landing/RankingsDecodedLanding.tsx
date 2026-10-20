'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Shield,
  Sparkles,
  BookOpen,
  Compass,
  FileText,
  Users,
  Award,
  Globe,
  ExternalLink,
  Send,
  Loader2,
  Menu,
  X,
  TrendingUp,
  Target,
  Search,
  Briefcase
} from 'lucide-react';

import RankingsDecodedLogo, { RankingsDecodedMark } from './RankingsDecodedLogo';

export default function RankingsDecodedLanding() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [laurelModalOpen, setLaurelModalOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 350);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Form State
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    firmName: '',
    role: '',
    country: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formState)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send enquiry. Please try again.');
      }
      setSubmitSuccess(true);
      setFormState({
        name: '',
        email: '',
        firmName: '',
        role: '',
        country: '',
        message: ''
      });
    } catch (err: any) {
      setSubmitError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // 11 FAQs from official October 2026 specification
  const faqs = [
    {
      q: 'What does Rankings Decoded do?',
      a: 'Rankings Decoded is a specialist advisory firm providing competitive intelligence, legal market positioning, communications strategy, rankings and recognition advisory, and guidance on publisher-related commercial investments. We help law firms make better-informed decisions about their competitive position, market visibility, and business development priorities.'
    },
    {
      q: 'Which legal directories do you work with?',
      a: 'We work with submissions to legal directories, specialist rankings, and recognition programmes worldwide. Our experience includes major international directories such as Chambers and Partners, The Legal 500, IFLR1000, and Leaders League, but our services are not limited to these publications. Each engagement is assessed according to the relevant methodology, jurisdiction, research requirements, and timetable.'
    },
    {
      q: 'Can you assess how our firm compares with competitors?',
      a: 'Yes. We conduct competitive assessments within selected practice areas and markets, examining the firm’s track record, available evidence, and positioning against relevant competitors. Our objective is to identify meaningful gaps, credible opportunities, and the actions needed to strengthen the firm’s competitive position.'
    },
    {
      q: 'Can you help us decide whether we should submit?',
      a: 'Yes. We evaluate whether the firm’s ambitions are supported by its current track record and evidence. Sometimes the right recommendation is to pursue recognition. In other cases, it may be to reconsider the category, strengthen the evidence, or defer participation.'
    },
    {
      q: 'Can you advise on our advertising and directory budgets?',
      a: 'Yes. We help firms evaluate publisher products, advertising opportunities, market intelligence services, and related commercial proposals. Our recommendations are based on the firm’s objectives, available resources, and the potential strategic relevance of each investment. We can also provide support in reviewing and negotiating commercial terms with publishers.'
    },
    {
      q: 'Can you help us improve our market narrative?',
      a: 'Yes. We assess how firms communicate their strengths and differentiators across practice areas, professional profiles, directories, and business development materials. Our recommendations focus on developing clear, credible messages supported by the firm’s actual experience and capabilities.'
    },
    {
      q: 'Can we engage you for a single submission or a specific project?',
      a: 'Absolutely. We work on individual submissions, competitive assessments, practice-specific assignments, and broader strategic engagements. You do not need to commission a comprehensive strategy project to access a specific service.'
    },
    {
      q: 'Do you work alongside our business development or marketing team?',
      a: 'Yes. We collaborate with internal teams and designated contacts to gather information, coordinate responsibilities, and ensure that the work progresses efficiently.'
    },
    {
      q: 'How are your fees structured?',
      a: 'Fees depend on the scope, complexity, research requirements, and level of support involved. We agree on deliverables, timelines, responsibilities, and commercial terms before work begins.'
    },
    {
      q: 'Do we need a software subscription?',
      a: 'No. Our advisory and submission services are available independently of any software subscription.'
    },
    {
      q: 'Can you guarantee a ranking?',
      a: 'No. Rankings and individual recognitions are determined independently by the relevant directories or award organisers. Our role is to help firms make informed decisions, present their evidence effectively, and approach the research process with a clear strategy. Advertising or commercial investments with publishers do not guarantee editorial recognition.'
    }
  ];

  return (
    <div style={{
      backgroundColor: '#FAF9F6', // Luxury Alabaster / warm ivory
      color: '#0F172A',
      fontFamily: "'Neue Montreal', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      lineHeight: 1.6,
      minHeight: '100vh',
      overflowX: 'hidden'
    }}>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 1. NAVIGATION BAR                                            */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: 'rgba(250, 249, 246, 0.94)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(15, 23, 42, 0.08)'
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0.85rem 1.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem'
        }}>
          {/* Brand Logo with Official Logomark */}
          <Link href="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
            <RankingsDecodedLogo variant="dark" size={34} textKicker="Legal Market Intelligence, Strategy & Advisory" />
          </Link>

          {/* Desktop Nav Links */}
          <div style={{ display: 'none', gap: '0.65rem', alignItems: 'center' }} className="desktop-menu">
            <button onClick={() => scrollToSection('services')} className="desktop-nav-link">Our Services</button>
            <button onClick={() => scrollToSection('approach')} className="desktop-nav-link">Our Approach</button>
            <button onClick={() => scrollToSection('technology')} className="desktop-nav-link">Technology</button>
            <button onClick={() => scrollToSection('about')} className="desktop-nav-link">About</button>
            <button onClick={() => scrollToSection('laurel-and-hell')} className="desktop-nav-link">Laurel & Hell</button>
            <button onClick={() => scrollToSection('faq')} className="desktop-nav-link">FAQ</button>
          </div>

          {/* Desktop Right CTA */}
          <div style={{ display: 'none', alignItems: 'center', gap: '0.9rem', flexShrink: 0 }} className="desktop-cta">
            <Link
              href="/login"
              className="client-portal-link"
              style={{
                fontSize: '0.84rem',
                color: '#475569',
                fontWeight: 500,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                padding: '0.35rem 0.65rem',
                borderRadius: '6px',
                transition: 'all 0.2s ease'
              }}
            >
              Client Portal
            </Link>
            <button
              onClick={() => scrollToSection('contact')}
              style={{
                background: 'linear-gradient(135deg, #1B44ED 0%, #0F172A 100%)',
                color: '#FFFFFF',
                padding: '0.55rem 1.25rem',
                borderRadius: '8px',
                fontSize: '0.84rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(27, 68, 237, 0.25)',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap'
              }}
            >
              Discuss Your Priorities
            </button>
          </div>

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#0F172A' }}
            className="mobile-toggle"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div
            className="mobile-menu-drawer"
            style={{
              backgroundColor: '#FAF9F6',
              borderBottom: '1px solid #E2E8F0',
              padding: '1.25rem 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}
          >
            <button onClick={() => scrollToSection('services')} className="mobile-nav-link">Our Services</button>
            <button onClick={() => scrollToSection('approach')} className="mobile-nav-link">Our Approach</button>
            <button onClick={() => scrollToSection('technology')} className="mobile-nav-link">Technology</button>
            <button onClick={() => scrollToSection('about')} className="mobile-nav-link">About</button>
            <button onClick={() => scrollToSection('laurel-and-hell')} className="mobile-nav-link">Laurel & Hell</button>
            <button onClick={() => scrollToSection('faq')} className="mobile-nav-link">FAQ</button>
            <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: '0.4rem 0' }} />
            <Link
              href="/login"
              className="mobile-nav-link"
              style={{ fontWeight: 600, color: '#1B44ED' }}
              onClick={() => setMobileMenuOpen(false)}
            >
              Client Portal
            </Link>
            <button
              onClick={() => scrollToSection('contact')}
              style={{
                background: 'linear-gradient(135deg, #1B44ED 0%, #0F172A 100%)',
                color: '#FFFFFF',
                padding: '0.85rem',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.92rem',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'center',
                boxShadow: '0 4px 15px rgba(27, 68, 237, 0.25)',
                marginTop: '0.35rem'
              }}
            >
              Discuss Your Priorities
            </button>
          </div>
        )}
      </nav>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 2. HERO SECTION (Midnight Authority & Prestige)             */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <section style={{
        backgroundColor: '#090E17',
        color: '#FFFFFF',
        padding: '5.5rem 1.75rem 5rem',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Subtle Dual Radial Glow: Cobalt Blue & Coral Sunset */}
        <div style={{
          position: 'absolute',
          top: '-20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '85vw',
          height: '45vw',
          background: 'radial-gradient(ellipse at 50% 0%, rgba(27, 68, 237, 0.28) 0%, rgba(255, 94, 54, 0.10) 45%, rgba(9, 14, 23, 0) 75%)',
          pointerEvents: 'none'
        }} />

        <div style={{ maxWidth: '960px', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 10 }}>
          {/* Eyebrow */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.45rem 1.25rem',
            borderRadius: '9999px',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.16)',
            fontSize: '0.78rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#CBD5E1',
            marginBottom: '2rem'
          }}>
            <RankingsDecodedMark size={16} variant="gradient" /> LEGAL MARKET INTELLIGENCE, STRATEGY & ADVISORY
          </div>

          {/* H1 Headline */}
          <h1 style={{
            fontSize: 'clamp(2.35rem, 5vw, 3.85rem)',
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: '-0.03em',
            margin: '0 0 1.75rem',
            color: '#F8FAFC'
          }}>
            A clearer view of your firm.<br />
            <span style={{
              background: 'linear-gradient(135deg, #CBD5E1 0%, #FFFFFF 50%, #94A3B8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              A stronger competitive position.
            </span>
          </h1>

          {/* Subtitle Paragraphs */}
          <div style={{
            fontSize: 'clamp(1.05rem, 2vw, 1.25rem)',
            lineHeight: 1.65,
            color: '#94A3B8',
            maxWidth: '840px',
            margin: '0 auto 2.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <p style={{ margin: 0 }}>
              Understand where your firm stands, how it compares with competitors, and where its strengths create genuine opportunities.
            </p>
            <p style={{ margin: 0, color: '#E2E8F0', fontWeight: 500 }}>
              We turn competitive intelligence into focused strategies for market positioning, legal recognition, communications, and smarter investment decisions.
            </p>
            <p style={{ margin: 0, fontSize: '1rem', color: '#38BDF8', fontWeight: 600, letterSpacing: '0.02em' }}>
              Independent advice. Rigorous analysis. Practical execution.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="hero-ctas" style={{
            display: 'flex',
            gap: '1.25rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginBottom: '4rem'
          }}>
            <button
              onClick={() => scrollToSection('contact')}
              style={{
                background: 'linear-gradient(135deg, #FF5E36 0%, #FF7A59 100%)',
                color: '#FFFFFF',
                padding: '0.95rem 2.25rem',
                borderRadius: '9px',
                fontSize: '0.98rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.65rem',
                boxShadow: '0 6px 25px rgba(255, 94, 54, 0.38)',
                transition: 'all 0.2s ease'
              }}
            >
              Discuss Your Firm’s Priorities <ArrowRight size={17} />
            </button>
            <button
              onClick={() => scrollToSection('services')}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: '#F8FAFC',
                padding: '0.95rem 1.95rem',
                borderRadius: '9px',
                fontSize: '0.98rem',
                fontWeight: 600,
                border: '1px solid rgba(255, 255, 255, 0.22)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Explore Our Services
            </button>
          </div>

          {/* Directory Credibility Bar */}
          <div style={{
            paddingTop: '2.5rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748B', fontWeight: 600 }}>
              Supporting Submissions & Strategy Across Leading Directories Worldwide
            </span>
            <div style={{
              display: 'flex',
              gap: 'clamp(1rem, 3vw, 2.5rem)',
              flexWrap: 'wrap',
              justifyContent: 'center',
              alignItems: 'center',
              fontSize: '0.92rem',
              fontWeight: 600,
              color: '#CBD5E1'
            }}>
              <span>Chambers and Partners</span>
              <span style={{ color: '#475569' }}>·</span>
              <span>The Legal 500</span>
              <span style={{ color: '#475569' }}>·</span>
              <span>IFLR1000</span>
              <span style={{ color: '#475569' }}>·</span>
              <span>Leaders League</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 3. STRATEGIC PERSPECTIVE                                     */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <section style={{ padding: '6rem 1.75rem', backgroundColor: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
          <div style={{ maxWidth: '820px', marginBottom: '3.5rem' }}>
            <span style={sectionEyebrowStyle}>Strategic Perspective</span>
            <h2 style={sectionH2Style}>
              Your next move starts with an honest assessment.
            </h2>
            <p style={{ fontSize: '1.15rem', color: '#475569', lineHeight: 1.7, margin: '1rem 0 0.85rem' }}>
              Your ambitions, your reputation, and the work you actually do may tell different stories.
            </p>
            <p style={{ fontSize: '1.05rem', color: '#64748B', lineHeight: 1.7 }}>
              We help you understand how they connect, where your competitive strengths are established, where the evidence falls short, and which opportunities deserve your attention and resources.
            </p>
          </div>

          {/* 6 Cards Balanced Grid (5 Questions + Strategic Synthesis Outcome) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
            marginBottom: '1rem'
          }}>
            {[
              {
                num: '01',
                q: 'What do you want recognition to achieve for your firm?',
                note: 'Connecting visibility and recognition initiatives with business development priorities and long-term market positioning.'
              },
              {
                num: '02',
                q: 'How does your practice genuinely compare with its competitors?',
                note: 'Evaluating the firm’s track record, capabilities, and evidence against the competitive landscape within a selected practice area or market.'
              },
              {
                num: '03',
                q: 'Are you competing in the right categories and markets?',
                note: 'Identifying where your capabilities support credible opportunities—and where a different strategic focus may deliver greater value.'
              },
              {
                num: '04',
                q: 'Does your market narrative reflect what makes your firm competitive?',
                note: 'Assessing whether your communications convey your genuine strengths, differentiate your practices, and support your commercial objectives.'
              },
              {
                num: '05',
                q: 'Are your investments in visibility and recognition advancing your business goals?',
                note: 'Examining whether advertising, directory participation, market intelligence products, and related investments are aligned with measurable strategic priorities.'
              }
            ].map((item) => (
              <div
                key={item.num}
                style={{
                  backgroundColor: '#FAF9F6',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '2rem 1.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'border-color 0.2s ease, transform 0.2s ease'
                }}
              >
                <div>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1B44ED', letterSpacing: '0.06em', display: 'block', marginBottom: '0.75rem' }}>
                    QUESTION {item.num}
                  </span>
                  <h3 style={{ fontSize: '1.18rem', fontWeight: 700, color: '#0F172A', lineHeight: 1.4, margin: '0 0 0.75rem' }}>
                    {item.q}
                  </h3>
                </div>
                <p style={{ fontSize: '0.92rem', color: '#64748B', margin: 0, borderTop: '1px solid #E2E8F0', paddingTop: '0.85rem', lineHeight: 1.6 }}>
                  {item.note}
                </p>
              </div>
            ))}

            {/* 6th Slot: Strategic Outcome & Executive Synthesis (Zero Dead Whitespace) */}
            <div
              style={{
                backgroundColor: '#090E17',
                border: '1px solid rgba(27, 68, 237, 0.4)',
                borderRadius: '12px',
                padding: '2rem 1.75rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 8px 24px rgba(9, 14, 23, 0.25)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#FF5E36', letterSpacing: '0.06em' }}>
                    THE STRATEGIC RESULT
                  </span>
                  <Sparkles size={18} color="#FF5E36" />
                </div>
                <h3 style={{ fontSize: '1.18rem', fontWeight: 700, color: '#F8FAFC', lineHeight: 1.4, margin: '0 0 0.75rem' }}>
                  A clearer view of what to put forward, what to strengthen, and where to change direction.
                </h3>
              </div>
              <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.12)', paddingTop: '0.85rem' }}>
                <p style={{ fontSize: '0.92rem', color: '#CBD5E1', fontStyle: 'italic', margin: '0 0 0.75rem', lineHeight: 1.6 }}>
                  “Sometimes, the most valuable recommendation is to redirect the effort.”
                </p>
                <button
                  onClick={() => scrollToSection('approach')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#60A5FA',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    cursor: 'pointer'
                  }}
                >
                  Explore our approach <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 4. WHEN WE CAN HELP (6 Scenarios Grid)                       */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <section style={{ padding: '6rem 1.75rem', backgroundColor: '#FAF9F6' }}>
        <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
          <div style={{ maxWidth: '820px', marginBottom: '3.5rem' }}>
            <span style={sectionEyebrowStyle}>When We Can Help</span>
            <h2 style={sectionH2Style}>
              Different challenges. One starting point: clarity.
            </h2>
            <p style={{ fontSize: '1.1rem', color: '#64748B', lineHeight: 1.7, margin: '1rem 0 0' }}>
              We work with law firms facing a range of strategic and operational challenges.
            </p>
          </div>

          <div className="when-we-help-grid">
            {[
              {
                tag: 'COMPETITIVE ASSESSMENT',
                icon: <Search size={22} color="#4338CA" />,
                title: 'Your firm is pursuing recognition without a clear competitive assessment.',
                desc: 'You need to understand whether your track record supports your ambitions and how your practice compares with established competitors.',
                focus: 'Validating band viability and evidentiary support against the competitive landscape.'
              },
              {
                tag: 'SUBMISSIONS & EVIDENCE',
                icon: <FileText size={22} color="#4338CA" />,
                title: 'Your submissions are not communicating your strongest work.',
                desc: 'You have the experience and matters, but the evidence, selection, or presentation may not adequately reflect the practice’s capabilities.',
                focus: 'Surfacing technical complexity, commercial significance, and team contribution.'
              },
              {
                tag: 'MARKET POSITIONING',
                icon: <Target size={22} color="#4338CA" />,
                title: 'Your market positioning lacks differentiation.',
                desc: 'Your practice descriptions, professional profiles, and communications may not clearly explain what sets your firm apart.',
                focus: 'Developing clear, credible messaging supported by genuine capabilities.'
              },
              {
                tag: 'BUDGET & INVESTMENTS',
                icon: <Briefcase size={22} color="#4338CA" />,
                title: 'You are unsure where to allocate your budget.',
                desc: 'You need independent guidance on directory participation, advertising, publisher products, and other visibility-related investments.',
                focus: 'Evaluating publisher products, commercial terms, and budget priorities.'
              },
              {
                tag: 'STRATEGIC REALIGNMENT',
                icon: <Globe size={22} color="#4338CA" />,
                title: 'Your business development priorities are changing.',
                desc: 'You are entering a new market, developing a practice, repositioning a team, or reconsidering where recognition efforts should be focused.',
                focus: 'Aligning recognition strategy with emerging practices and market expansion.'
              },
              {
                tag: 'SPECIALIST EXECUTION',
                icon: <Users size={22} color="#4338CA" />,
                title: 'Your team needs specialist guidance or execution support.',
                desc: 'You need experienced assistance with research cycles, submissions, competitive analysis, or the coordination of a broader positioning strategy.',
                focus: 'Collaborative partnership providing senior direction and milestone delivery.'
              }
            ].map((card, idx) => (
              <div
                key={idx}
                className="when-we-help-card"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '14px',
                  border: '1px solid #E2E8F0',
                  padding: '2.25rem 2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1.25rem',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                  position: 'relative'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <div style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      backgroundColor: '#EEF2FF',
                      border: '1px solid #E0E7FF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {card.icon}
                    </div>
                    <span style={{
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      color: '#4338CA',
                      backgroundColor: '#F8FAFC',
                      padding: '0.3rem 0.65rem',
                      borderRadius: '6px',
                      border: '1px solid #E2E8F0',
                      textTransform: 'uppercase'
                    }}>
                      {card.tag}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.22rem', fontWeight: 700, color: '#0F172A', lineHeight: 1.35, margin: '0 0 0.85rem' }}>
                    {card.title}
                  </h3>

                  <p style={{ fontSize: '0.96rem', color: '#475569', lineHeight: 1.68, margin: 0 }}>
                    {card.desc}
                  </p>
                </div>

                <div style={{
                  borderTop: '1px solid #F1F5F9',
                  paddingTop: '1rem',
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '0.5rem',
                  fontSize: '0.86rem',
                  color: '#64748B',
                  lineHeight: 1.5
                }}>
                  <span style={{ fontWeight: 700, color: '#4338CA' }}>Focus:</span>
                  <span>{card.focus}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 5. OUR SERVICES (Modular Advisory Offerings)                 */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <section id="services" style={{ padding: '6rem 1.75rem', backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
          <div style={{ maxWidth: '840px', marginBottom: '3.5rem' }}>
            <span style={sectionEyebrowStyle}>Our Services</span>
            <h2 style={sectionH2Style}>
              Better intelligence. Sharper positioning. Smarter decisions.
            </h2>
            <div style={{ fontSize: '1.05rem', color: '#475569', lineHeight: 1.75, margin: '1.25rem 0 0', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <p style={{ margin: 0 }}>
                Recognition is only one part of a law firm’s competitive strategy.
              </p>
              <p style={{ margin: 0 }}>
                We help firms understand where they stand, how they compare with competitors, what differentiates their practices, and where their resources can create the greatest strategic value.
              </p>
              <p style={{ margin: 0, color: '#0F172A', fontWeight: 600 }}>
                From competitive intelligence and market positioning to submissions, communications, and publisher negotiations, our work connects evidence-based analysis with practical business decisions.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '2rem' }}>
            {[
              {
                num: '01',
                title: 'Competitive Intelligence & Market Positioning',
                subtitle: 'Know where you stand before deciding where to compete.',
                desc: 'We conduct rigorous assessments of law firms’ competitive positions within selected practice areas, jurisdictions, and legal market segments. Our analysis examines the firm’s track record, client portfolio, matter complexity, sector strengths, and available evidence against the competitive landscape. We identify material gaps, test the credibility of ranking ambitions, and assess where the firm has a defensible opportunity to compete—and where its resources may be better directed elsewhere.',
                deliverables: 'Competitive benchmarking, practice assessments, gap analyses, positioning diagnostics, and prioritised strategic recommendations.'
              },
              {
                num: '02',
                title: 'Strategic Positioning & Communications',
                subtitle: 'Build a narrative your evidence can support.',
                desc: 'Strong legal work does not automatically translate into a clear or differentiated market position. We assess how a firm communicates its capabilities across practice areas, identify inconsistencies or missed opportunities, and help develop narratives that reflect its genuine strengths and commercial priorities. Our work may include reviewing practice descriptions, identifying differentiating messages, and advising on how the firm’s positioning should evolve across directories, professional profiles, and other business development communications.',
                deliverables: 'Narrative assessments, practice positioning recommendations, key messaging frameworks, and communications improvement plans.'
              },
              {
                num: '03',
                title: 'Legal Rankings & Recognition Advisory',
                subtitle: 'Make every submission a stronger reflection of your work.',
                desc: 'We advise on the full legal recognition process, from selecting the right categories and evaluating available evidence to developing submissions and preparing for research cycles. Our services include matter selection, evidence review, submission drafting and editing, referee strategy, research coordination, and post-cycle assessments. We work across legal directories, specialist rankings, individual lawyer nominations, industry awards, diversity and inclusion submissions, pro bono recognition, and other professional recognition programmes worldwide.',
                deliverables: 'Submission strategies, prioritised matter selections, completed or reviewed submissions, referee recommendations, and research cycle action plans.'
              },
              {
                num: '04',
                title: 'Investment & Publisher Advisory',
                subtitle: 'Invest with purpose, not out of habit.',
                desc: 'Legal publishers offer an extensive range of advertising, enhanced profiles, market intelligence products, research services, and commercial partnerships. We help firms assess which opportunities are relevant to their objectives, how to allocate budgets, and whether proposed investments are commercially justified. Our support may include evaluating publisher proposals, comparing products, reviewing fees and commercial conditions, and advising on negotiations concerning pricing, payment terms, and contractual arrangements.',
                deliverables: 'Investment assessments, budget allocation recommendations, publisher product evaluations, commercial proposal reviews, and negotiation support.'
              },
              {
                num: '05',
                title: 'Integrated Legal Market Strategy',
                subtitle: 'Connect recognition, reputation, and investment to business goals.',
                desc: 'A ranking, an advertising investment, or a communications initiative should not be an end in itself. We help firms build coordinated strategies that connect their competitive position, practice priorities, recognition ambitions, communications, and commercial investments. Our approach begins with the firm’s business objectives and works backwards to identify the initiatives, resources, and evidence needed to support them.',
                deliverables: 'Integrated positioning strategies, investment priorities, cross-practice action plans, and strategic roadmaps with defined objectives and review points.'
              }
            ].map((srv) => (
              <div
                key={srv.num}
                className="service-card-item"
                style={{
                  backgroundColor: '#FAF9F6',
                  borderRadius: '14px',
                  border: '1px solid #E2E8F0',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '2.5rem',
                  alignItems: 'start'
                }}
              >
                {/* Left Column: Number, Title, Subtitle + Deliverables (Fills Left Column Gracefully) */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1B44ED', letterSpacing: '0.06em', display: 'block', marginBottom: '0.5rem' }}>
                    SERVICE {srv.num}
                  </span>
                  <h3 style={{ fontSize: '1.42rem', fontWeight: 700, color: '#0F172A', margin: '0 0 0.5rem', lineHeight: 1.25 }}>
                    {srv.title}
                  </h3>
                  <p style={{ fontSize: '0.98rem', color: '#475569', fontWeight: 600, margin: '0 0 1.25rem', lineHeight: 1.45 }}>
                    {srv.subtitle}
                  </p>
                  <div style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    padding: '0.95rem 1.15rem',
                    fontSize: '0.86rem',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)'
                  }}>
                    <strong style={{ display: 'block', color: '#0F172A', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>
                      Typical deliverables
                    </strong>
                    <span style={{ color: '#64748B', lineHeight: 1.55 }}>
                      {srv.deliverables}
                    </span>
                  </div>
                </div>

                {/* Right Column: Strategic Narrative Paragraph */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <p style={{ fontSize: '1rem', color: '#475569', lineHeight: 1.8, margin: 0 }}>
                    {srv.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Callout Banner */}
          <div style={{
            marginTop: '3.5rem',
            padding: '2.5rem',
            borderRadius: '14px',
            backgroundColor: '#090E17',
            border: '1px solid rgba(27, 68, 237, 0.25)',
            color: '#FFFFFF',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1.5rem',
            boxShadow: '0 8px 30px rgba(9, 14, 23, 0.12)'
          }}>
            <div style={{ maxWidth: '640px' }}>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 0.5rem', color: '#F8FAFC' }}>
                Every engagement begins with a question worth answering.
              </h3>
              <p style={{ fontSize: '0.98rem', color: '#94A3B8', margin: 0, lineHeight: 1.6 }}>
                Whether your firm needs a single submission, a competitive assessment, or a broader strategy, we define the scope around the decisions you need to make.
              </p>
            </div>
            <button
              onClick={() => scrollToSection('contact')}
              style={{
                background: 'linear-gradient(135deg, #FF5E36 0%, #FF7A59 100%)',
                color: '#FFFFFF',
                padding: '0.9rem 2rem',
                borderRadius: '8px',
                fontSize: '0.94rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.55rem',
                boxShadow: '0 4px 20px rgba(255, 94, 54, 0.35)',
                transition: 'all 0.2s ease'
              }}
            >
              Discuss Your Firm’s Priorities <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 6. OUR APPROACH (Process & Responsibilities)                */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <section id="approach" style={{ padding: '6rem 1.75rem', backgroundColor: '#FAF9F6' }}>
        <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
          <div style={{ maxWidth: '780px', marginBottom: '3.5rem' }}>
            <span style={sectionEyebrowStyle}>Our Approach</span>
            <h2 style={sectionH2Style}>
              Direct advice. Close collaboration. Clear responsibilities.
            </h2>
          </div>

          {/* 4 Process Steps */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: '1.5rem',
            marginBottom: '3rem'
          }}>
            {[
              {
                step: '1',
                title: 'Understand your priorities',
                desc: 'We discuss your firm’s business objectives, competitive position, market ambitions, current challenges, and existing investments in visibility and recognition.'
              },
              {
                step: '2',
                title: 'Assess the evidence and competitive landscape',
                desc: 'We examine the available information, test the assumptions behind your ambitions, identify material gaps, and evaluate the opportunities supported by your firm’s capabilities.'
              },
              {
                step: '3',
                title: 'Develop the strategy and deliverables',
                desc: 'Depending on the engagement, we prepare competitive assessments, positioning recommendations, submissions, communications guidance, investment evaluations, or integrated strategic plans. We work closely with your designated contact to validate information and refine the agreed deliverables.'
              },
              {
                step: '4',
                title: 'Turn insights into next steps',
                desc: 'We translate our findings into practical recommendations, helping your team understand what to prioritise, what to improve, and how to prepare for future opportunities.'
              }
            ].map((st) => (
              <div
                key={st.step}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  padding: '2.25rem 1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  position: 'relative'
                }}
              >
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  backgroundColor: '#0F172A',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.95rem'
                }}>
                  {st.step}
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0F172A', lineHeight: 1.35, margin: 0 }}>
                  {st.title}
                </h3>
                <p style={{ fontSize: '0.9rem', color: '#64748B', lineHeight: 1.65, margin: 0 }}>
                  {st.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Flexible Engagement Model Callout */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '2.25rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '2rem',
            alignItems: 'start'
          }}>
            <div>
              <h4 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0F172A', margin: '0 0 0.5rem' }}>
                A flexible engagement model
              </h4>
              <p style={{ fontSize: '0.95rem', color: '#475569', lineHeight: 1.7, margin: 0 }}>
                These stages provide a framework, not a mandatory sequence. Engagements may cover a single submission, a competitive assessment, a specific commercial decision, or a broader programme of strategic support.
              </p>
            </div>
            <div>
              <h4 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0F172A', margin: '0 0 0.5rem' }}>
                Clear commercial terms upfront
              </h4>
              <p style={{ fontSize: '0.95rem', color: '#475569', lineHeight: 1.7, margin: 0 }}>
                Scope, responsibilities, deliverables, timelines, and fees are agreed in advance, ensuring complete predictability and focus throughout.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 7. TECHNOLOGY SECTION (Proprietary Advantage)               */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <section id="technology" style={{
        padding: '6rem 1.75rem',
        backgroundColor: '#0F172A',
        color: '#FFFFFF'
      }}>
        <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '3.5rem',
            alignItems: 'center'
          }}>
            <div>
              <span style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                color: '#818CF8',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                display: 'block',
                marginBottom: '0.75rem'
              }}>
                Proprietary Platform
              </span>
              <h2 style={{
                fontSize: 'clamp(2rem, 3.8vw, 2.75rem)',
                fontWeight: 700,
                lineHeight: 1.2,
                color: '#F8FAFC',
                margin: '0 0 1.5rem',
                letterSpacing: '-0.02em'
              }}>
                Expert-led advice, supported by technology.
              </h2>
              <div style={{ fontSize: '1.02rem', color: '#94A3B8', lineHeight: 1.75, display: 'flex', flexDirection: 'column', gap: '1.1rem', marginBottom: '2rem' }}>
                <p style={{ margin: 0 }}>
                  Rankings Decoded is developing proprietary technology to support the analysis, organisation, and review of legal directory submissions and related evidence.
                </p>
                <p style={{ margin: 0 }}>
                  Our technology is designed to complement professional judgement—not replace it.
                </p>
                <p style={{ margin: 0 }}>
                  As the platform evolves, its capabilities are being tested and progressively introduced into our workflow, with expert oversight remaining central to every engagement.
                </p>
                <p style={{ margin: 0 }}>
                  Our broader advisory services draw on professional expertise, structured analysis, and appropriate research methodologies, independently of the software development timetable.
                </p>
              </div>

              <div style={{
                padding: '1.25rem 1.5rem',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                marginBottom: '1.5rem'
              }}>
                <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#FCD34D', letterSpacing: '-0.01em' }}>
                  Strategic analysis comes first. Technology helps us execute it more effectively.
                </p>
              </div>

              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.65rem',
                fontSize: '0.88rem',
                color: '#CBD5E1',
                fontWeight: 500
              }}>
                <Shield size={16} color="#818CF8" />
                Clients can engage Rankings Decoded without purchasing a software subscription.
              </div>
            </div>

            {/* Visual Feature Card */}
            <div style={{
              backgroundColor: '#1E293B',
              border: '1px solid #334155',
              borderRadius: '16px',
              padding: '2.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.75rem',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.3)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid #334155', paddingBottom: '1.25rem' }}>
                <Sparkles size={20} color="#818CF8" />
                <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#F8FAFC' }}>
                  The Rankings Decoded Difference
                </span>
              </div>

              <div style={{ display: 'grid', gap: '1.35rem', fontSize: '0.94rem', color: '#CBD5E1', lineHeight: 1.6 }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'start' }}>
                  <CheckCircle2 size={18} color="#818CF8" style={{ flexShrink: 0, marginTop: 3 }} />
                  <div><strong>Strategic Triage:</strong> Distinguishing wishful thinking from genuine evidentiary weight before committing partner time.</div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'start' }}>
                  <CheckCircle2 size={18} color="#818CF8" style={{ flexShrink: 0, marginTop: 3 }} />
                  <div><strong>Evidence Deep-Dive:</strong> Uncovering technical complexity and deal significance that drafting teams routinely miss.</div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'start' }}>
                  <CheckCircle2 size={18} color="#818CF8" style={{ flexShrink: 0, marginTop: 3 }} />
                  <div><strong>Competitive Benchmarking:</strong> Testing practice strengths against ranked peers in your specific market and category.</div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'start' }}>
                  <CheckCircle2 size={18} color="#818CF8" style={{ flexShrink: 0, marginTop: 3 }} />
                  <div><strong>Executive Leadership:</strong> Senior-level strategic guidance and substantive review led personally by Ángela Castillo.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 8. ABOUT SECTION (Led by Ángela Castillo)                   */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <section id="about" style={{ padding: '6rem 1.75rem', backgroundColor: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
            gap: '3.5rem',
            alignItems: 'start',
            marginBottom: '4rem'
          }}>
            {/* Left Column: Bio Card + Institutional Foundation & Experience (Eliminating Empty Space) */}
            <div className="about-left-sticky" style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}>
              {/* Profile Card */}
              <div style={{
                backgroundColor: '#FAF9F6',
                border: '1px solid #E2E8F0',
                borderRadius: '16px',
                padding: '2.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.15rem'
              }}>
                <div style={{
                  width: 78,
                  height: 78,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #090E17 0%, #1B44ED 100%)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 6px 20px rgba(27, 68, 237, 0.25)',
                  border: '2px solid rgba(255, 255, 255, 0.8)'
                }}>
                  <RankingsDecodedMark size={42} variant="light" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.45rem', fontWeight: 700, color: '#0F172A', margin: '0 0 0.25rem' }}>
                    Ángela Castillo
                  </h3>
                  <span style={{ fontSize: '0.9rem', color: '#1B44ED', fontWeight: 700, display: 'block' }}>
                    Founder & Principal Strategist
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#64748B', display: 'block', marginTop: '0.2rem' }}>
                    Chambers and Partners · Thomson Reuters · IBA · Co-founder of LexLatin
                  </span>
                </div>
                <p style={{ fontSize: '0.88rem', color: '#64748B', lineHeight: 1.6, margin: 0, borderTop: '1px solid #E2E8F0', paddingTop: '0.9rem' }}>
                  Combines firsthand experience within legal information, research, publishing, and international professional organisations with years of advising law firms on positioning and recognition.
                </p>
              </div>

              {/* Institutional Pedigree & Credentials Block (Balances Height with Right Column) */}
              <div style={{
                backgroundColor: '#FAF9F6',
                border: '1px solid #E2E8F0',
                borderRadius: '16px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem'
              }}>
                <span style={{
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  color: '#1B44ED',
                  textTransform: 'uppercase'
                }}>
                  Institutional Foundation & Ecosystem
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.65rem' }}>
                  {[
                    {
                      name: 'Chambers and Partners',
                      role: 'Former Editor & Research Lead',
                      tag: 'Editorial'
                    },
                    {
                      name: 'Thomson Reuters',
                      role: 'Legal Intelligence & Solutions',
                      tag: 'Intelligence'
                    },
                    {
                      name: 'International Bar Association (IBA)',
                      role: 'Global Professional Relationships',
                      tag: 'Global Network'
                    },
                    {
                      name: 'LexLatin',
                      role: 'Co-founder & Legal Publishing',
                      tag: 'Founding Lead'
                    }
                  ].map((inst, i) => (
                    <div
                      key={i}
                      style={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: '8px',
                        padding: '0.75rem 0.95rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0F172A' }}>{inst.name}</span>
                        <span style={{ fontSize: '0.76rem', color: '#64748B' }}>{inst.role}</span>
                      </div>
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        color: '#1B44ED',
                        backgroundColor: 'rgba(27, 68, 237, 0.08)',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        whiteSpace: 'nowrap'
                      }}>
                        {inst.tag}
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{
                  borderTop: '1px solid #E2E8F0',
                  paddingTop: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <CheckCircle2 size={15} color="#1B44ED" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600 }}>
                    Direct founder leadership on all strategic client reviews
                  </span>
                </div>
              </div>
            </div>

            {/* Right Narrative (All 5 Paragraphs) */}
            <div>
              <span style={sectionEyebrowStyle}>About</span>
              <h2 style={{ ...sectionH2Style, margin: '0 0 1.5rem' }}>
                Led by Ángela Castillo.
              </h2>
              <div style={{ fontSize: '1.02rem', color: '#475569', lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                <p style={{ margin: 0 }}>
                  Ángela Castillo brings extensive experience across the international legal industry, with a professional background spanning Chambers and Partners, Thomson Reuters, the International Bar Association (IBA), and LexLatin, which she co-founded.
                </p>
                <p style={{ margin: 0 }}>
                  Her career has given her a distinctive perspective on the legal market, combining experience within legal information, research, publishing, and professional organisations with years of advising law firms on their positioning, visibility, and recognition strategies.
                </p>
                <p style={{ margin: 0 }}>
                  Having worked on different sides of the legal publishing and rankings ecosystem, Ángela understands not only how firms seek recognition, but also how research organisations, publishers, and commercial stakeholders operate.
                </p>
                <p style={{ margin: 0 }}>
                  Her international professional network and longstanding industry relationships complement an approach grounded in independent judgement, rigorous evidence assessment, and a realistic understanding of each firm’s competitive position.
                </p>
                <p style={{ margin: 0, color: '#0F172A', fontWeight: 600 }}>
                  At Rankings Decoded, Ángela personally leads strategic assessments, key recommendations, and substantive reviews, working closely with clients to identify genuine strengths, challenge unsupported ambitions, and turn market intelligence into informed decisions.
                </p>
              </div>

              <div style={{ marginTop: '2rem' }}>
                <button
                  onClick={() => scrollToSection('contact')}
                  style={{
                    background: 'linear-gradient(135deg, #1B44ED 0%, #0F172A 100%)',
                    color: '#FFFFFF',
                    padding: '0.85rem 1.8rem',
                    borderRadius: '8px',
                    fontSize: '0.92rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 4px 15px rgba(27, 68, 237, 0.25)'
                  }}
                >
                  Discuss Your Firm’s Priorities <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* 2 Sub-Cards: Collaborative Delivery & Working Worldwide */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
            gap: '2rem',
            borderTop: '1px solid #E2E8F0',
            paddingTop: '3.5rem'
          }}>
            <div style={{
              backgroundColor: '#FAF9F6',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              padding: '2rem 2.25rem'
            }}>
              <h4 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0F172A', margin: '0 0 0.75rem' }}>
                Specialist leadership, collaborative delivery
              </h4>
              <p style={{ fontSize: '0.95rem', color: '#475569', lineHeight: 1.7, margin: '0 0 0.85rem' }}>
                Rankings Decoded combines founder-led strategic advice with dedicated operational and project support.
              </p>
              <p style={{ fontSize: '0.92rem', color: '#64748B', lineHeight: 1.65, margin: 0 }}>
                Every engagement benefits from direct senior-level oversight, while research coordination, information gathering, and project delivery are supported by a collaborative working model designed around each client’s needs.
              </p>
            </div>

            <div style={{
              backgroundColor: '#FAF9F6',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              padding: '2rem 2.25rem'
            }}>
              <h4 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0F172A', margin: '0 0 0.75rem' }}>
                Working with firms worldwide
              </h4>
              <p style={{ fontSize: '0.95rem', color: '#475569', lineHeight: 1.7, margin: '0 0 0.85rem' }}>
                Rankings Decoded welcomes enquiries from law firms anywhere in the world.
              </p>
              <p style={{ fontSize: '0.92rem', color: '#64748B', lineHeight: 1.65, margin: 0 }}>
                Our advice is tailored to each firm’s jurisdiction, market positioning, competitive landscape, research requirements, and business objectives. Every engagement is assessed individually to ensure that its scope and methodology reflect the realities of the relevant legal market.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 9. LAUREL & HELL (Editorial Thought Leadership)             */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <section id="laurel-and-hell" style={{
        padding: '6rem 1.75rem',
        backgroundColor: '#1E1B18', // Deep Espresso Parchment
        color: '#FBF9F5',
        position: 'relative'
      }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.35rem 1rem',
            borderRadius: '9999px',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            fontSize: '0.76rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#FCD34D',
            marginBottom: '1.75rem'
          }}>
            <BookOpen size={14} color="#FCD34D" /> Behind every submission, there’s a story
          </div>

          <h2 style={{
            fontSize: 'clamp(2.2rem, 4.5vw, 3.25rem)',
            fontWeight: 700,
            lineHeight: 1.2,
            margin: '0 0 1.25rem',
            letterSpacing: '-0.02em',
            color: '#FFFDF9'
          }}>
            Laurel & Hell by Ángela Castillo
          </h2>

          <p style={{
            fontSize: '1.25rem',
            fontWeight: 500,
            color: '#D4CEBA',
            lineHeight: 1.55,
            margin: '0 0 1.25rem',
            fontStyle: 'italic'
          }}>
            An independent editorial publication exploring the language, contradictions, ambitions, and realities of recognition in the legal industry.
          </p>

          <p style={{
            fontSize: '1.05rem',
            color: '#A8A29E',
            lineHeight: 1.75,
            maxWidth: '680px',
            margin: '0 auto 2.5rem'
          }}>
            Sharp observations, critical perspectives, and informed commentary on the business of being recognised.
          </p>

          <div>
            <button
              onClick={() => setLaurelModalOpen(true)}
              style={{
                backgroundColor: '#FCD34D',
                color: '#1C1917',
                padding: '0.9rem 2.2rem',
                borderRadius: '8px',
                fontSize: '0.95rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 20px rgba(252, 211, 77, 0.25)'
              }}
            >
              Read Laurel & Hell <ExternalLink size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 10. FREQUENTLY ASKED QUESTIONS (FAQ)                         */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <section id="faq" style={{ padding: '6rem 1.75rem', backgroundColor: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <span style={sectionEyebrowStyle}>Frequently Asked Questions</span>
            <h2 style={sectionH2Style}>
              Clear answers to common questions.
            </h2>
          </div>

          <div style={{ display: 'grid', gap: '1rem' }}>
            {faqs.map((faq, index) => {
              const isOpen = activeFaq === index;
              return (
                <div
                  key={index}
                  style={{
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    backgroundColor: isOpen ? '#FAF9F6' : '#FFFFFF',
                    transition: 'all 0.2s ease',
                    overflow: 'hidden'
                  }}
                >
                  <button
                    onClick={() => setActiveFaq(isOpen ? null : index)}
                    style={{
                      width: '100%',
                      padding: '1.5rem 1.75rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '1.08rem',
                      fontWeight: 700,
                      color: '#0F172A',
                      gap: '1rem'
                    }}
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      size={20}
                      color="#64748B"
                      style={{
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                        flexShrink: 0
                      }}
                    />
                  </button>
                  {isOpen && (
                    <div style={{
                      padding: '0 1.75rem 1.5rem',
                      fontSize: '0.98rem',
                      color: '#475569',
                      lineHeight: 1.75,
                      borderTop: '1px solid #F1F5F9',
                      paddingTop: '1rem'
                    }}>
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 11. CONTACT & LEAD CAPTURE FORM                              */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <section id="contact" style={{ padding: '6.5rem 1.75rem', backgroundColor: '#FAF9F6' }}>
        <div style={{ maxWidth: '820px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <span style={sectionEyebrowStyle}>Get in Touch</span>
            <h2 style={{ ...sectionH2Style, margin: '0 0 1rem' }}>
              Let’s bring clarity to your next move.
            </h2>
            <p style={{ fontSize: '1.15rem', color: '#0F172A', fontWeight: 600, lineHeight: 1.6, margin: '0 auto 0.75rem', maxWidth: '680px' }}>
              What does your firm want to achieve—and what is making the process difficult?
            </p>
            <p style={{ fontSize: '0.98rem', color: '#64748B', lineHeight: 1.65, margin: '0 auto', maxWidth: '680px' }}>
              Whether you are evaluating your competitive position, preparing submissions, reviewing your market narrative, or reconsidering your investment priorities, we would be pleased to explore how we can help.
            </p>
            <p style={{ fontSize: '0.95rem', color: '#475569', lineHeight: 1.6, margin: '0.75rem auto 0', maxWidth: '680px' }}>
              Tell us a little about your objectives. We will review your enquiry and get in touch to discuss the right next step.
            </p>
          </div>

          <div
            className="contact-card-box"
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '16px',
              boxShadow: '0 10px 35px rgba(0, 0, 0, 0.04)'
            }}
          >
            {submitSuccess ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <div style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  backgroundColor: '#DCFCE7',
                  color: '#15803D',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.5rem'
                }}>
                  <CheckCircle2 size={32} />
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0F172A', margin: '0 0 0.75rem' }}>
                  Thank you for getting in touch.
                </h3>
                <p style={{ fontSize: '1.05rem', color: '#475569', lineHeight: 1.6, maxWidth: '500px', margin: '0 auto 1.75rem' }}>
                  We have received your enquiry and will contact you about the next step.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitSuccess(false)}
                  style={{
                    backgroundColor: '#0F172A',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.75rem 1.5rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleFormSubmit} style={{ display: 'grid', gap: '1.4rem' }}>
                {submitError && (
                  <div style={{
                    padding: '0.9rem 1.25rem',
                    borderRadius: '8px',
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FCA5A5',
                    color: '#991B1B',
                    fontSize: '0.9rem'
                  }}>
                    {submitError}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.4rem' }}>
                  <div>
                    <label style={formLabelStyle}>Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Jane Smith"
                      value={formState.name}
                      onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                      style={formInputStyle}
                    />
                  </div>

                  <div>
                    <label style={formLabelStyle}>Work Email *</label>
                    <input
                      type="email"
                      required
                      placeholder="jane.smith@firm.com"
                      value={formState.email}
                      onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                      style={formInputStyle}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.4rem' }}>
                  <div>
                    <label style={formLabelStyle}>Firm Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Smith & Partners"
                      value={formState.firmName}
                      onChange={(e) => setFormState({ ...formState, firmName: e.target.value })}
                      style={formInputStyle}
                    />
                  </div>

                  <div>
                    <label style={formLabelStyle}>Role / Title</label>
                    <input
                      type="text"
                      placeholder="Managing Partner / BD Director"
                      value={formState.role}
                      onChange={(e) => setFormState({ ...formState, role: e.target.value })}
                      style={formInputStyle}
                    />
                  </div>
                </div>

                <div>
                  <label style={formLabelStyle}>Country / Jurisdiction</label>
                  <input
                    type="text"
                    placeholder="United Kingdom, Mexico, Singapore, or multiple jurisdictions"
                    value={formState.country}
                    onChange={(e) => setFormState({ ...formState, country: e.target.value })}
                    style={formInputStyle}
                  />
                </div>

                <div>
                  <label style={formLabelStyle}>
                    What would you like to achieve or improve? *
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Tell us about your firm’s priorities, competitive challenges, recognition objectives, or investment decisions."
                    value={formState.message}
                    onChange={(e) => setFormState({ ...formState, message: e.target.value })}
                    style={{ ...formInputStyle, resize: 'vertical' }}
                  />
                  <span style={{ fontSize: '0.8rem', color: '#64748B', display: 'block', marginTop: '0.4rem' }}>
                    Please provide a general overview. Do not include confidential client or matter information at this stage.
                  </span>
                </div>

                <div style={{ fontSize: '0.82rem', color: '#64748B', lineHeight: 1.5 }}>
                  We will use the information you provide to respond to your enquiry. See our{' '}
                  <button
                    type="button"
                    onClick={() => setPrivacyModalOpen(true)}
                    style={{ background: 'none', border: 'none', color: '#4338CA', textDecoration: 'underline', cursor: 'pointer', padding: 0, font: 'inherit' }}
                  >
                    Privacy Notice
                  </button>{' '}
                  for details.
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    background: 'linear-gradient(135deg, #FF5E36 0%, #FF7A59 100%)',
                    color: '#FFFFFF',
                    padding: '1rem 2rem',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: 700,
                    border: 'none',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.65rem',
                    boxShadow: '0 6px 20px rgba(255, 94, 54, 0.35)',
                    transition: 'all 0.2s ease',
                    marginTop: '0.5rem'
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" /> Sending Enquiry…
                    </>
                  ) : (
                    <>
                      Send Enquiry <Send size={16} />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 12. FOOTER                                                   */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <footer style={{
        backgroundColor: '#090E17',
        color: '#94A3B8',
        padding: '4.5rem 1.75rem 3rem',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'start',
            flexWrap: 'wrap',
            gap: '2.5rem',
            marginBottom: '3rem'
          }}>
            <div>
              <div style={{ marginBottom: '0.85rem' }}>
                <RankingsDecodedLogo variant="light" size={38} />
              </div>
              <p style={{ fontSize: '0.92rem', color: '#64748B', maxWidth: '420px', margin: 0, lineHeight: 1.6 }}>
                Independent advice for stronger competitive positioning and smarter business decisions.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1.75rem', flexWrap: 'wrap', fontSize: '0.9rem', color: '#CBD5E1' }}>
              <button onClick={() => scrollToSection('services')} style={footerNavButtonStyle}>Our Services</button>
              <button onClick={() => scrollToSection('approach')} style={footerNavButtonStyle}>Our Approach</button>
              <button onClick={() => scrollToSection('technology')} style={footerNavButtonStyle}>Technology</button>
              <button onClick={() => scrollToSection('about')} style={footerNavButtonStyle}>About</button>
              <button onClick={() => scrollToSection('laurel-and-hell')} style={footerNavButtonStyle}>Laurel & Hell</button>
              <button onClick={() => scrollToSection('faq')} style={footerNavButtonStyle}>FAQ</button>
              <button onClick={() => scrollToSection('contact')} style={footerNavButtonStyle}>Contact</button>
            </div>

            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.86rem', color: '#64748B' }}>
              <button onClick={() => setPrivacyModalOpen(true)} style={footerNavButtonStyle}>Privacy Notice</button>
              <button onClick={() => setTermsModalOpen(true)} style={footerNavButtonStyle}>Terms of Use</button>
              <Link href="/login" style={{ ...footerNavButtonStyle, color: '#818CF8', fontWeight: 600 }}>
                Client Portal
              </Link>
            </div>
          </div>

          <div style={{
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            paddingTop: '2rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            fontSize: '0.8rem',
            color: '#64748B'
          }}>
            <p style={{ margin: 0 }}>
              Rankings Decoded is an independent consultancy and is not affiliated with the directories named on this website.
            </p>
            <p style={{ margin: 0 }}>
              © 2026 Rankings Decoded. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* PRIVACY NOTICE MODAL                                         */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {privacyModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            maxWidth: '560px',
            width: '100%',
            padding: '2rem',
            maxHeight: '85vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Privacy Notice</h3>
              <button onClick={() => setPrivacyModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <p style={{ fontSize: '0.92rem', color: '#475569', lineHeight: 1.6 }}>
              At Rankings Decoded, we treat all enquiries with strict professional discretion.
            </p>
            <p style={{ fontSize: '0.92rem', color: '#475569', lineHeight: 1.6 }}>
              The information you provide in the contact form is used solely to respond to your enquiry, assess the potential fit of an engagement, and communicate with you about our legal market intelligence, strategy, and advisory services.
            </p>
            <p style={{ fontSize: '0.92rem', color: '#475569', lineHeight: 1.6 }}>
              We do not share your information with third parties. Prior to formal engagement, we recommend sharing only non-confidential information. Confidential client or matter information should only be shared under an agreed Non-Disclosure Agreement (NDA).
            </p>
            <button
              onClick={() => setPrivacyModalOpen(false)}
              style={{
                marginTop: '1rem',
                backgroundColor: '#0F172A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '0.65rem 1.25rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* TERMS OF USE MODAL                                           */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {termsModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            maxWidth: '560px',
            width: '100%',
            padding: '2rem',
            maxHeight: '85vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Terms of Use</h3>
              <button onClick={() => setTermsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <p style={{ fontSize: '0.92rem', color: '#475569', lineHeight: 1.6 }}>
              The materials and information contained on this website are provided for general informational and marketing purposes only and do not constitute formal legal advice or a binding contractual commitment.
            </p>
            <p style={{ fontSize: '0.92rem', color: '#475569', lineHeight: 1.6 }}>
              Rankings Decoded is an independent consultancy. All client advisory services, deliverables, scopes of work, and fees are governed exclusively by formal, written engagement agreements entered into between Rankings Decoded and the respective client law firm.
            </p>
            <p style={{ fontSize: '0.92rem', color: '#475569', lineHeight: 1.6 }}>
              Directory names and trademarks (such as Chambers and Partners, The Legal 500, IFLR1000, and Leaders League) are the property of their respective owners and are referenced solely for descriptive and informational purposes.
            </p>
            <button
              onClick={() => setTermsModalOpen(false)}
              style={{
                marginTop: '1rem',
                backgroundColor: '#0F172A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '0.65rem 1.25rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* LAUREL & HELL PREVIEW MODAL                                  */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {laurelModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#1E1B18',
            color: '#FBF9F5',
            borderRadius: '14px',
            maxWidth: '600px',
            width: '100%',
            padding: '2.5rem',
            maxHeight: '85vh',
            overflowY: 'auto',
            border: '1px solid rgba(255, 255, 255, 0.15)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#FCD34D', fontWeight: 700 }}>
                Laurel & Hell · By Ángela Castillo
              </span>
              <button onClick={() => setLaurelModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1' }}><X size={20} /></button>
            </div>
            <h3 style={{ fontSize: '1.6rem', fontWeight: 700, margin: '0 0 1rem', color: '#FFFDF9' }}>
              Behind every submission, there’s a story.
            </h3>
            <p style={{ fontSize: '1rem', color: '#D4CEBA', lineHeight: 1.7, fontStyle: 'italic', marginBottom: '1.25rem' }}>
              “Ambitious partners. Undocumented matters. Deadlines approaching faster than the information.”
            </p>
            <p style={{ fontSize: '0.95rem', color: '#A8A29E', lineHeight: 1.75, marginBottom: '2rem' }}>
              Laurel & Hell is an independent editorial publication exploring the language, contradictions, ambitions, and realities of recognition in the legal industry. Sharp observations, critical perspectives, and informed commentary on the business of being recognised.
            </p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  setLaurelModalOpen(false);
                  scrollToSection('contact');
                }}
                style={{
                  backgroundColor: '#FCD34D',
                  color: '#1C1917',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.75rem 1.5rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Inquire / Subscribe to Laurel & Hell
              </button>
              <button
                onClick={() => setLaurelModalOpen(false)}
                style={{
                  backgroundColor: 'transparent',
                  color: '#CBD5E1',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  padding: '0.75rem 1.25rem',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Back to Top Floating Button */}
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="back-to-top-btn"
          aria-label="Volver arriba"
          title="Volver arriba"
        >
          <ChevronUp size={22} color="#FFFFFF" />
        </button>
      )}

      {/* Global Scoped Responsive CSS */}
      <style jsx>{`
        /* Desktop Navigation Links Hover State */
        .desktop-nav-link {
          background: none;
          border: none;
          font-size: 0.85rem;
          color: #475569;
          font-weight: 500;
          cursor: pointer;
          padding: 0.35rem 0.65rem;
          border-radius: 6px;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          white-space: nowrap;
        }
        .desktop-nav-link:hover {
          color: #0F172A !important;
          background-color: rgba(15, 23, 42, 0.06);
        }
        .client-portal-link:hover {
          color: #0F172A !important;
          background-color: rgba(15, 23, 42, 0.05);
        }

        /* Mobile Menu Links */
        .mobile-nav-link {
          background: none;
          border: none;
          font-size: 0.95rem;
          color: #334155;
          font-weight: 500;
          cursor: pointer;
          padding: 0.65rem 0.75rem;
          border-radius: 8px;
          text-align: left;
          transition: all 0.15s ease;
          display: block;
          text-decoration: none;
        }
        .mobile-nav-link:hover, .mobile-nav-link:active {
          color: #0F172A;
          background-color: rgba(15, 23, 42, 0.06);
        }
        .mobile-menu-drawer {
          animation: slideDownMenu 0.22s ease-out forwards;
        }
        @keyframes slideDownMenu {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Back to Top Floating Button */
        .back-to-top-btn {
          position: fixed;
          bottom: 2rem;
          right: 2rem;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, #090E17 0%, #1B44ED 100%);
          border: 1px solid rgba(255, 255, 255, 0.25);
          color: #FFFFFF;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(9, 14, 23, 0.35), 0 2px 8px rgba(27, 68, 237, 0.25);
          z-index: 49;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .back-to-top-btn:hover {
          transform: translateY(-3px) scale(1.06);
          background: #1B44ED !important;
          border-color: rgba(255, 255, 255, 0.45);
          box-shadow: 0 12px 30px rgba(27, 68, 237, 0.45);
        }

        /* Card Paddings & Layout */
        .service-card-item {
          padding: 2.5rem 2.25rem;
        }
        .contact-card-box {
          padding: 2.75rem;
        }

        .when-we-help-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.75rem;
        }
        @media (min-width: 768px) {
          .when-we-help-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        .when-we-help-card {
          transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .when-we-help-card:hover {
          transform: translateY(-2px);
          border-color: #C7D2FE !important;
          box-shadow: 0 12px 24px -6px rgba(67, 56, 202, 0.08), 0 4px 10px rgba(0, 0, 0, 0.03) !important;
        }

        /* Desktop Breakpoint for Navbar & Sticky Columns */
        @media (min-width: 1024px) {
          .desktop-menu {
            display: flex !important;
          }
          .desktop-cta {
            display: flex !important;
          }
          .mobile-toggle {
            display: none !important;
          }
          .about-left-sticky {
            position: sticky !important;
            top: 90px !important;
          }
        }

        /* Tablet & Mobile Specific Tweaks */
        @media (max-width: 1023px) {
          .about-left-sticky {
            position: static !important;
          }
        }

        @media (max-width: 768px) {
          .service-card-item {
            padding: 1.65rem 1.25rem !important;
            gap: 1.5rem !important;
          }
          .contact-card-box {
            padding: 1.75rem 1.25rem !important;
          }
          .hero-ctas {
            flex-direction: column !important;
            width: 100% !important;
            align-items: stretch !important;
            gap: 0.85rem !important;
          }
          .hero-ctas button {
            width: 100% !important;
            justify-content: center !important;
          }
          .back-to-top-btn {
            bottom: 1.25rem !important;
            right: 1.25rem !important;
            width: 44px !important;
            height: 44px !important;
          }
          input, textarea {
            font-size: 16px !important;
          }
        }
      `}</style>
    </div>
  );
}

const navLinkStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: '0.84rem',
  color: '#334155',
  fontWeight: 500,
  cursor: 'pointer',
  padding: '0.2rem 0.2rem',
  transition: 'color 0.15s ease',
  whiteSpace: 'nowrap'
};

const footerNavButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: '0.88rem',
  color: '#CBD5E1',
  fontWeight: 500,
  cursor: 'pointer',
  padding: 0,
  transition: 'color 0.15s ease'
};

const sectionEyebrowStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 700,
  color: '#1B44ED', // Official Brand Cobalt Blue
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  display: 'block',
  marginBottom: '0.75rem'
};

const sectionH2Style: React.CSSProperties = {
  fontSize: 'clamp(2rem, 3.8vw, 2.85rem)',
  fontWeight: 700,
  lineHeight: 1.2,
  color: '#0F172A',
  margin: 0,
  letterSpacing: '-0.025em'
};

const formLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.86rem',
  fontWeight: 600,
  color: '#334155',
  marginBottom: '0.4rem'
};

const formInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem 0.95rem',
  borderRadius: '8px',
  border: '1px solid #CBD5E1',
  backgroundColor: '#FAF9F6',
  fontSize: '0.95rem',
  color: '#0F172A',
  outline: 'none',
  boxSizing: 'border-box'
};
