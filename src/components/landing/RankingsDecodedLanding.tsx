'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Shield,
  Sparkles,
  BookOpen,
  Compass,
  FileText,
  Users,
  Calendar,
  Layers,
  Award,
  Globe,
  HelpCircle,
  ExternalLink,
  Lock,
  Send,
  Loader2,
  Menu,
  X
} from 'lucide-react';

export default function RankingsDecodedLanding() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [laurelModalOpen, setLaurelModalOpen] = useState(false);

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

  const faqs = [
    {
      q: 'Which directories do you support?',
      a: 'We support submissions to Chambers and Partners, The Legal 500, IFLR1000, and Leaders League. Each proposal specifies the relevant guides, practices, and submissions.'
    },
    {
      q: 'Can you help us decide whether to submit?',
      a: 'Yes. Assessing whether your ambitions are supported by the available evidence is a core part of our work. We may recommend proceeding, strengthening the practice before submitting, or directing your effort towards a more appropriate category.'
    },
    {
      q: 'Can we engage you for a single practice?',
      a: 'Yes. We can scope a focused assessment or submission engagement, as well as broader programmes covering several practices and directories.'
    },
    {
      q: 'Can you work alongside our business development or marketing team?',
      a: 'Yes. We collaborate with your existing team. Your firm appoints an internal lead to consolidate materials and coordinate partner input.'
    },
    {
      q: 'How are fees structured?',
      a: 'Fees reflect the scope, complexity, and level of support required. Your proposal sets out deliverables, responsibilities, timelines, and payment terms before work begins.'
    },
    {
      q: 'Do we need a software subscription?',
      a: 'No. You can engage Rankings Decoded for specialist advice and submission support without purchasing a software subscription. Technology supports our delivery where appropriate.'
    },
    {
      q: 'Can you guarantee a ranking?',
      a: 'Ranking decisions belong to each directory. Our commitment is to provide candid advice, rigorous analysis, and submissions that communicate your firm’s work accurately and effectively.'
    }
  ];

  return (
    <div style={{
      backgroundColor: '#FAF9F6', // Luxury Alabaster / warm ivory
      color: '#0F172A',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
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
        backgroundColor: 'rgba(250, 249, 246, 0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(15, 23, 42, 0.08)'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '1.1rem 1.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          {/* Brand Logo */}
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: '#0F172A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#F8FAFC',
              fontWeight: 800,
              fontSize: '1rem',
              letterSpacing: '-0.02em',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.15)'
            }}>
              RD
            </div>
            <div>
              <span style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0F172A', letterSpacing: '-0.02em', display: 'block', lineHeight: 1.1 }}>
                Rankings Decoded
              </span>
              <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Legal Rankings Strategy
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <div style={{ display: 'none', gap: '2rem', alignItems: 'center' }} className="desktop-menu">
            <button onClick={() => scrollToSection('services')} style={navLinkStyle}>Our Services</button>
            <button onClick={() => scrollToSection('approach')} style={navLinkStyle}>Our Approach</button>
            <button onClick={() => scrollToSection('technology')} style={navLinkStyle}>Technology</button>
            <button onClick={() => scrollToSection('about')} style={navLinkStyle}>About</button>
            <button onClick={() => scrollToSection('laurel-and-hell')} style={navLinkStyle}>Laurel & Hell</button>
            <button onClick={() => scrollToSection('faq')} style={navLinkStyle}>FAQ</button>
          </div>

          {/* Desktop Right CTA */}
          <div style={{ display: 'none', alignItems: 'center', gap: '1.25rem' }} className="desktop-cta">
            <Link href="/login" style={{ fontSize: '0.88rem', color: '#475569', fontWeight: 500, textDecoration: 'none', transition: 'color 0.15s' }}>
              Client Portal
            </Link>
            <button
              onClick={() => scrollToSection('contact')}
              style={{
                backgroundColor: '#0F172A',
                color: '#FFFFFF',
                padding: '0.65rem 1.4rem',
                borderRadius: '8px',
                fontSize: '0.88rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(15, 23, 42, 0.12)',
                transition: 'all 0.2s ease'
              }}
            >
              Let’s Talk
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
          <div style={{
            backgroundColor: '#FAF9F6',
            borderBottom: '1px solid #E2E8F0',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.2rem'
          }}>
            <button onClick={() => scrollToSection('services')} style={{ ...navLinkStyle, textAlign: 'left' }}>Our Services</button>
            <button onClick={() => scrollToSection('approach')} style={{ ...navLinkStyle, textAlign: 'left' }}>Our Approach</button>
            <button onClick={() => scrollToSection('technology')} style={{ ...navLinkStyle, textAlign: 'left' }}>Technology</button>
            <button onClick={() => scrollToSection('about')} style={{ ...navLinkStyle, textAlign: 'left' }}>About</button>
            <button onClick={() => scrollToSection('laurel-and-hell')} style={{ ...navLinkStyle, textAlign: 'left' }}>Laurel & Hell</button>
            <button onClick={() => scrollToSection('faq')} style={{ ...navLinkStyle, textAlign: 'left' }}>FAQ</button>
            <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: '0.5rem 0' }} />
            <Link href="/login" style={{ fontSize: '0.95rem', color: '#475569', fontWeight: 600 }}>Client Portal (Sign In)</Link>
            <button
              onClick={() => scrollToSection('contact')}
              style={{
                backgroundColor: '#0F172A',
                color: '#FFFFFF',
                padding: '0.8rem',
                borderRadius: '8px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              Let’s Talk
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
        {/* Subtle Radial Glow */}
        <div style={{
          position: 'absolute',
          top: '-15%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '70vw',
          height: '40vw',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, rgba(9, 14, 23, 0) 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ maxWidth: '960px', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 10 }}>
          {/* Eyebrow */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.35rem 1rem',
            borderRadius: '9999px',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.16)',
            fontSize: '0.78rem',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#CBD5E1',
            marginBottom: '2rem'
          }}>
            <Compass size={14} color="#818CF8" /> Legal Rankings Strategy & Advisory
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
              A stronger case for recognition.
            </span>
          </h1>

          {/* Subtitle Paragraphs */}
          <div style={{
            fontSize: 'clamp(1.05rem, 2vw, 1.25rem)',
            lineHeight: 1.65,
            color: '#94A3B8',
            maxWidth: '820px',
            margin: '0 auto 2.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <p style={{ margin: 0 }}>
              Understand where your firm stands, uncover its strengths, and recognise the gaps between its ambitions and its evidence.
            </p>
            <p style={{ margin: 0, color: '#E2E8F0', fontWeight: 500 }}>
              We turn that clarity into a focused legal rankings strategy—one that reflects your capabilities today and supports the practice you want to build.
            </p>
            <p style={{ margin: 0, fontSize: '0.98rem', color: '#64748B' }}>
              Specialist advice, personal attention, and submission support, backed by proprietary technology.
            </p>
          </div>

          {/* Action CTAs */}
          <div style={{
            display: 'flex',
            gap: '1.25rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginBottom: '4rem'
          }}>
            <button
              onClick={() => scrollToSection('contact')}
              style={{
                backgroundColor: '#F8FAFC',
                color: '#0F172A',
                padding: '0.95rem 2rem',
                borderRadius: '9px',
                fontSize: '0.98rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.6rem',
                boxShadow: '0 4px 20px rgba(255, 255, 255, 0.15)',
                transition: 'all 0.2s ease'
              }}
            >
              Discuss Your Firm’s Priorities <ArrowRight size={17} />
            </button>
            <button
              onClick={() => scrollToSection('approach')}
              style={{
                backgroundColor: 'transparent',
                color: '#E2E8F0',
                padding: '0.95rem 1.85rem',
                borderRadius: '9px',
                fontSize: '0.98rem',
                fontWeight: 500,
                border: '1px solid rgba(255, 255, 255, 0.25)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Explore Our Approach
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
              Supporting Submissions & Strategy Across Leading Directories
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
          <div style={{ maxWidth: '780px', marginBottom: '3.5rem' }}>
            <span style={sectionEyebrowStyle}>Strategic Perspective</span>
            <h2 style={sectionH2Style}>
              Your next move starts with an honest assessment.
            </h2>
            <p style={{ fontSize: '1.15rem', color: '#475569', lineHeight: 1.7, margin: '1rem 0 1.25rem' }}>
              Your ambitions, your reputation, and the work you actually do may tell different stories.
            </p>
            <p style={{ fontSize: '1.05rem', color: '#64748B', lineHeight: 1.7 }}>
              We work with you to understand how they connect: where your strengths are established, where the evidence falls short, and where your capabilities may support an opportunity you have overlooked.
            </p>
          </div>

          {/* 5 Questions Cards Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
            gap: '1.5rem',
            marginBottom: '3rem'
          }}>
            {[
              {
                num: '01',
                q: 'What do you want recognition to achieve for your firm?',
                note: 'Connecting directory participation with real business development and market positioning.'
              },
              {
                num: '02',
                q: 'Does the practice you want recognised have the track record to support it?',
                note: 'Evaluating if the current client roster and mandates sustain a top-tier band claim.'
              },
              {
                num: '03',
                q: 'Are your strongest matters being presented in the right category?',
                note: 'Identifying whether adjacent practices or sub-sectors offer a far more credible fit.'
              },
              {
                num: '04',
                q: 'What can your clients credibly say about your work?',
                note: 'Structuring referee strategy around substantiated first-hand buyer experience.'
              },
              {
                num: '05',
                q: 'As your clients and markets change, where should you concentrate your efforts?',
                note: 'Directing partner hours and marketing budget towards maximum strategic return.'
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
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#4338CA', letterSpacing: '0.05em', display: 'block', marginBottom: '0.75rem' }}>
                    QUESTION {item.num}
                  </span>
                  <h3 style={{ fontSize: '1.18rem', fontWeight: 700, color: '#0F172A', lineHeight: 1.4, margin: '0 0 0.75rem' }}>
                    {item.q}
                  </h3>
                </div>
                <p style={{ fontSize: '0.9rem', color: '#64748B', margin: 0, borderTop: '1px solid #E2E8F0', paddingTop: '0.85rem' }}>
                  {item.note}
                </p>
              </div>
            ))}
          </div>

          {/* Standout Takeaway Callout */}
          <div style={{
            backgroundColor: '#0F172A',
            color: '#FFFFFF',
            borderRadius: '14px',
            padding: '2.5rem 3rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            boxShadow: '0 8px 30px rgba(15, 23, 42, 0.08)'
          }}>
            <p style={{ fontSize: '1.25rem', fontWeight: 600, color: '#E2E8F0', margin: 0, lineHeight: 1.5 }}>
              The result is a clearer view of what to put forward, what to strengthen, and where to change direction.
            </p>
            <p style={{ fontSize: '1.35rem', fontWeight: 700, color: '#FCD34D', margin: 0, letterSpacing: '-0.01em' }}>
              “Sometimes, the most valuable recommendation is to redirect the effort.”
            </p>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 4. WHEN WE CAN HELP (4 Key Triggers)                         */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <section style={{ padding: '6rem 1.75rem', backgroundColor: '#FAF9F6' }}>
        <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
          <div style={{ maxWidth: '780px', marginBottom: '3.5rem' }}>
            <span style={sectionEyebrowStyle}>When We Can Help</span>
            <h2 style={sectionH2Style}>
              Support for the decisions that shape your next research cycle.
            </h2>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1.75rem'
          }}>
            {[
              {
                icon: <FileText size={24} color="#4338CA" />,
                title: 'Your submissions are not communicating the strength of your practice.',
                desc: 'We examine the evidence, the positioning, and the way your work is presented to identify what needs attention.'
              },
              {
                icon: <Award size={24} color="#4338CA" />,
                title: 'You want recognition in a new practice or market.',
                desc: 'We assess how far your existing capabilities support that ambition, what remains to be developed, and whether another category offers a stronger fit.'
              },
              {
                icon: <Globe size={24} color="#4338CA" />,
                title: 'Your business is changing.',
                desc: 'As client needs, sectors, and growth priorities evolve, we help you reassess what your rankings strategy should support.'
              },
              {
                icon: <Users size={24} color="#4338CA" />,
                title: 'Your team needs experienced guidance and delivery support.',
                desc: 'We work alongside partners and business development or marketing teams to bring direction, structure, and specialist execution to the process.'
              }
            ].map((card, idx) => (
              <div
                key={idx}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  padding: '2.25rem 1.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.2rem',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                }}
              >
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 10,
                  backgroundColor: '#EEF2FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {card.icon}
                </div>
                <h3 style={{ fontSize: '1.18rem', fontWeight: 700, color: '#0F172A', lineHeight: 1.4, margin: 0 }}>
                  {card.title}
                </h3>
                <p style={{ fontSize: '0.94rem', color: '#64748B', lineHeight: 1.65, margin: 0 }}>
                  {card.desc}
                </p>
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
          <div style={{ maxWidth: '780px', marginBottom: '3.5rem' }}>
            <span style={sectionEyebrowStyle}>Our Services</span>
            <h2 style={sectionH2Style}>
              From understanding your practice to presenting its strongest case.
            </h2>
          </div>

          <div style={{ display: 'grid', gap: '2rem' }}>
            {[
              {
                num: '01',
                title: 'Practice Assessment & Strategic Direction',
                subtitle: 'Build an honest picture of your practice and its prospects for recognition.',
                desc: 'We assess your work, client base, team capabilities, and current positioning against your ambitions and the relevant directory categories. From there, we recommend what to pursue now, what needs strengthening, and where to refocus—connecting your rankings strategy with the direction in which you want your firm to grow.'
              },
              {
                num: '02',
                title: 'Matter Selection & Evidence Review',
                subtitle: 'Identify what your work demonstrates—and what needs further explanation.',
                desc: 'We analyse available materials, select and prioritise matters, and identify gaps in the evidence. Targeted questions help bring out the legal complexity, commercial significance, and contribution of your team. The aim is to build a credible account of your capabilities, grounded in the work you have actually done.'
              },
              {
                num: '03',
                title: 'Submission Development & Review',
                subtitle: 'Translate your evidence into a clear, well-supported submission.',
                desc: 'We develop and refine practice narratives, matter descriptions, and lawyer profiles, adapting the material to each directory’s requirements. Every submission is reviewed for accuracy, relevance, and consistency, in coordination with your designated internal contact.'
              },
              {
                num: '04',
                title: 'Referee Strategy',
                subtitle: 'Choose people who can speak meaningfully about your work.',
                desc: 'We advise on referee selection, considering first-hand experience, relevance to the practice, and the perspective each person can contribute. We also guide your team’s approach to outreach and follow-up, with clear responsibilities agreed from the outset.'
              },
              {
                num: '05',
                title: 'Research Cycle Advisory',
                subtitle: 'Keep priorities, decisions, and delivery connected.',
                desc: 'We establish milestones, guide key decisions, and coordinate agreed reviews with your internal lead. As the cycle progresses, we identify evidence gaps and practical steps to strengthen future submissions.'
              }
            ].map((srv) => (
              <div
                key={srv.num}
                style={{
                  backgroundColor: '#FAF9F6',
                  borderRadius: '14px',
                  border: '1px solid #E2E8F0',
                  padding: '2.5rem 2.25rem',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '2rem',
                  alignItems: 'start'
                }}
              >
                <div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#4338CA', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>
                    SERVICE {srv.num}
                  </span>
                  <h3 style={{ fontSize: '1.45rem', fontWeight: 700, color: '#0F172A', margin: '0 0 0.5rem', lineHeight: 1.25 }}>
                    {srv.title}
                  </h3>
                  <p style={{ fontSize: '1rem', color: '#475569', fontWeight: 600, margin: 0 }}>
                    {srv.subtitle}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '0.98rem', color: '#64748B', lineHeight: 1.75, margin: 0 }}>
                    {srv.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* DEI and Pro Bono Scope Callout */}
          <div style={{
            marginTop: '2.5rem',
            padding: '1.25rem 1.75rem',
            borderRadius: '10px',
            backgroundColor: '#F1F5F9',
            border: '1px solid #CBD5E1',
            fontSize: '0.92rem',
            color: '#475569',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <Sparkles size={18} color="#4338CA" />
            <span>
              <strong>Additional Scope:</strong> DEI, pro bono, and awards submissions can be included through a separately defined scope.
            </span>
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
                desc: 'We discuss your firm’s objectives, directory experience, current challenges, and upcoming research cycles.'
              },
              {
                step: '2',
                title: 'Assess the evidence and agree direction',
                desc: 'We examine the available materials, test the assumptions behind your ambitions, and establish priorities for the engagement.'
              },
              {
                step: '3',
                title: 'Build and refine submissions',
                desc: 'We develop the agreed materials, raise focused questions, and work through reviews with your designated contact.'
              },
              {
                step: '4',
                title: 'Prepare for the next cycle',
                desc: 'We identify what to retain, what to improve, and what your team should begin documenting to support future ambitions.'
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

          {/* Operating Agreement Box */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '2rem 2.25rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
            alignItems: 'center'
          }}>
            <div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', margin: '0 0 0.5rem' }}>
                Collaborative Operating Model
              </h4>
              <p style={{ fontSize: '0.94rem', color: '#475569', lineHeight: 1.65, margin: 0 }}>
                Your firm appoints an internal lead to consolidate information and coordinate partner input. Rankings Decoded provides specialist direction and delivers the agreed work.
              </p>
            </div>
            <div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', margin: '0 0 0.5rem' }}>
                Defined Engagements
              </h4>
              <p style={{ fontSize: '0.94rem', color: '#475569', lineHeight: 1.65, margin: 0 }}>
                Each engagement defines the practices, directories, deliverables, review rounds, timetable, and fees upfront with absolute clarity.
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
              <p style={{ fontSize: '1.05rem', color: '#94A3B8', lineHeight: 1.75, margin: '0 0 1.25rem' }}>
                We are developing proprietary technology to support the analysis, preparation, and review of legal directory submissions.
              </p>
              <p style={{ fontSize: '1.02rem', color: '#CBD5E1', lineHeight: 1.75, margin: '0 0 1.5rem' }}>
                Introduced progressively into our workflow, it helps us streamline repeatable tasks and create more capacity for substantive analysis and personal attention.
              </p>
              <p style={{ fontSize: '0.95rem', color: '#94A3B8', lineHeight: 1.7, margin: '0 0 2rem' }}>
                Professional judgment guides the process: understanding the significance of a matter, assessing the strength of a practice, identifying appropriate referees, and recommending where to focus.
              </p>

              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.75rem 1.25rem',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                fontSize: '0.88rem',
                color: '#E2E8F0',
                fontWeight: 500
              }}>
                <Shield size={16} color="#818CF8" />
                Our advisory services are available independently of a software subscription.
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
                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#F8FAFC' }}>
                  The Rankings Decoded Difference
                </span>
              </div>

              <div style={{ display: 'grid', gap: '1.2rem', fontSize: '0.92rem', color: '#CBD5E1' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'start' }}>
                  <CheckCircle2 size={18} color="#818CF8" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div><strong>Strategic Triage:</strong> Distinguishing wishful thinking from genuine evidentiary weight.</div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'start' }}>
                  <CheckCircle2 size={18} color="#818CF8" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div><strong>Evidence Deep-Dive:</strong> Uncovering technical legal complexity that associates often miss.</div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'start' }}>
                  <CheckCircle2 size={18} color="#818CF8" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div><strong>AI Substantive Audit:</strong> Automated validation against directory guidelines and peer precedents.</div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'start' }}>
                  <CheckCircle2 size={18} color="#818CF8" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div><strong>Executive Supervision:</strong> 1-on-1 strategic leadership by Ángela Castillo throughout.</div>
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
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '3.5rem',
            alignItems: 'center'
          }}>
            {/* Left Bio Avatar / Credential Card */}
            <div style={{
              backgroundColor: '#FAF9F6',
              border: '1px solid #E2E8F0',
              borderRadius: '16px',
              padding: '2.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}>
              <div style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                backgroundColor: '#0F172A',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.75rem',
                fontWeight: 700,
                letterSpacing: '-0.02em'
              }}>
                AC
              </div>
              <div>
                <h3 style={{ fontSize: '1.45rem', fontWeight: 700, color: '#0F172A', margin: '0 0 0.25rem' }}>
                  Ángela Castillo
                </h3>
                <span style={{ fontSize: '0.88rem', color: '#4338CA', fontWeight: 600, display: 'block' }}>
                  Founder & Principal Strategist
                </span>
                <span style={{ fontSize: '0.82rem', color: '#64748B' }}>
                  Co-founder of LexLatin · Legal Rankings Authority
                </span>
              </div>
              <p style={{ fontSize: '0.88rem', color: '#64748B', lineHeight: 1.6, margin: 0, borderTop: '1px solid #E2E8F0', paddingTop: '1rem' }}>
                Advising partners and law firms across international markets with deep sector knowledge and editorial precision.
              </p>
            </div>

            {/* Right Narrative */}
            <div>
              <span style={sectionEyebrowStyle}>About</span>
              <h2 style={{ ...sectionH2Style, margin: '0 0 1.5rem' }}>
                Led by Ángela Castillo.
              </h2>
              <div style={{ fontSize: '1.02rem', color: '#475569', lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                <p style={{ margin: 0 }}>
                  Ángela Castillo brings together experience in legal directory strategy and submissions with her perspective as a co-founder of <strong>LexLatin</strong>.
                </p>
                <p style={{ margin: 0 }}>
                  She leads the strategy of each engagement and participates directly in key decisions and reviews, working with your firm’s designated team.
                </p>
                <p style={{ margin: 0 }}>
                  Her approach begins with the substance of your practice: understanding the work, questioning assumptions, and identifying the evidence that supports a credible case for recognition.
                </p>
                <p style={{ margin: 0, color: '#64748B', fontSize: '0.95rem' }}>
                  Built with an international outlook, Rankings Decoded welcomes enquiries from firms across <strong>Asia-Pacific, Europe, Latin America, and beyond</strong>. Each engagement is assessed against the relevant jurisdiction, research requirements, language needs, and timetable.
                </p>
              </div>

              <div style={{ marginTop: '2rem' }}>
                <button
                  onClick={() => scrollToSection('contact')}
                  style={{
                    backgroundColor: '#0F172A',
                    color: '#FFFFFF',
                    padding: '0.85rem 1.8rem',
                    borderRadius: '8px',
                    fontSize: '0.92rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  Discuss Your Firm’s Priorities <ArrowRight size={16} />
                </button>
              </div>
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
            <BookOpen size={14} color="#FCD34D" /> A Rankings Decoded Publication
          </div>

          <h2 style={{
            fontSize: 'clamp(2.2rem, 4.5vw, 3.25rem)',
            fontWeight: 700,
            lineHeight: 1.2,
            margin: '0 0 1.25rem',
            letterSpacing: '-0.02em',
            color: '#FFFDF9'
          }}>
            Behind every submission, there’s a story.
          </h2>

          <p style={{
            fontSize: '1.35rem',
            fontWeight: 500,
            color: '#D4CEBA',
            lineHeight: 1.5,
            margin: '0 0 1.5rem',
            fontStyle: 'italic'
          }}>
            “Ambitious partners. Undocumented matters. Deadlines approaching faster than the information.”
          </p>

          <p style={{
            fontSize: '1.05rem',
            color: '#A8A29E',
            lineHeight: 1.75,
            maxWidth: '680px',
            margin: '0 auto 2.5rem'
          }}>
            <strong>Laurel & Hell</strong> explores the decisions, tensions, and habits behind legal rankings—with humour, perspective, and practical insight. Written by Ángela Castillo.
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
                      fontSize: '1.1rem',
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
                      lineHeight: 1.7,
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
            <p style={{ fontSize: '1.15rem', color: '#475569', lineHeight: 1.6, margin: '0 auto 0.5rem', maxWidth: '640px' }}>
              What does your firm want to achieve—and what is making the process difficult?
            </p>
            <p style={{ fontSize: '0.98rem', color: '#64748B', lineHeight: 1.6, margin: 0 }}>
              Tell us a little about your priorities. We will review your enquiry and get in touch to explore the right next step.
            </p>
          </div>

          <div style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '16px',
            padding: '2.75rem',
            boxShadow: '0 10px 35px rgba(0, 0, 0, 0.04)'
          }}>
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
                      placeholder="e.g. María González"
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
                      placeholder="e.g. mgonzalez@firm.com"
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
                      placeholder="e.g. González & Partners Abogados"
                      value={formState.firmName}
                      onChange={(e) => setFormState({ ...formState, firmName: e.target.value })}
                      style={formInputStyle}
                    />
                  </div>

                  <div>
                    <label style={formLabelStyle}>Role / Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Managing Partner / BD Director"
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
                    placeholder="e.g. Mexico, Colombia, Spain, Regional"
                    value={formState.country}
                    onChange={(e) => setFormState({ ...formState, country: e.target.value })}
                    style={formInputStyle}
                  />
                </div>

                <div>
                  <label style={formLabelStyle}>
                    What would you like to achieve or improve through your legal directory participation? *
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Please provide a general overview of your practice areas, current challenges, or upcoming cycles..."
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
                    backgroundColor: '#0F172A',
                    color: '#FFFFFF',
                    padding: '1rem 2rem',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.65rem',
                    boxShadow: '0 4px 15px rgba(15, 23, 42, 0.15)',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.75rem' }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  backgroundColor: '#FFFFFF',
                  color: '#0F172A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.9rem'
                }}>
                  RD
                </div>
                <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#F8FAFC' }}>
                  Rankings Decoded
                </span>
              </div>
              <p style={{ fontSize: '0.92rem', color: '#64748B', maxWidth: '380px', margin: 0, lineHeight: 1.6 }}>
                Legal rankings strategy. Evidence. Expert guidance.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', fontSize: '0.9rem', color: '#CBD5E1' }}>
              <a href="https://www.linkedin.com" target="_blank" rel="noopener noreferrer" style={footerLinkStyle}>
                LinkedIn
              </a>
              <button onClick={() => setLaurelModalOpen(true)} style={{ ...footerLinkStyle, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                Laurel & Hell
              </button>
              <button onClick={() => scrollToSection('contact')} style={{ ...footerLinkStyle, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                Contact
              </button>
              <button onClick={() => setPrivacyModalOpen(true)} style={{ ...footerLinkStyle, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                Privacy Notice
              </button>
              <Link href="/login" style={{ ...footerLinkStyle, color: '#818CF8', fontWeight: 600 }}>
                Client Sign In
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
              © {new Date().getFullYear()} Rankings Decoded. All rights reserved.
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
              The information you provide in the contact form is used solely to respond to your enquiry, assess the potential fit of an engagement, and communicate with you about our legal rankings strategy services.
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
              Laurel & Hell is an exclusive editorial column exploring the real decisions, political tensions, and ingrained habits behind international legal rankings—delivered with humour, sharp perspective, and practical wisdom.
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
                Subscribe / Inquire about Laurel & Hell
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

      {/* Global Scoped Responsive CSS */}
      <style jsx>{`
        @media (min-width: 860px) {
          .desktop-menu {
            display: flex !important;
          }
          .desktop-cta {
            display: flex !important;
          }
          .mobile-toggle {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

const navLinkStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: '0.9rem',
  color: '#475569',
  fontWeight: 500,
  cursor: 'pointer',
  padding: 0,
  transition: 'color 0.15s ease'
};

const sectionEyebrowStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 700,
  color: '#4338CA',
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

const footerLinkStyle: React.CSSProperties = {
  textDecoration: 'none',
  color: '#94A3B8',
  fontSize: '0.88rem',
  fontWeight: 500,
  transition: 'color 0.15s ease'
};
