import React, { useRef, useState } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'motion/react';
import { ArrowUp, ArrowRight } from 'lucide-react';
import { useCollection } from '../context/CollectionContext';

const DRIVE_FOUNDER_IMAGE = 'https://lh3.googleusercontent.com/d/1bY2b0Kvev6jag6XJiVTcbx2X5dV8Drl2';
const LOCAL_FOUNDER_IMAGE = '/mainsite.jpg';

export const AboutUs: React.FC = () => {
  const { openShop } = useCollection();
  const [imageSrc, setImageSrc] = useState<string>(DRIVE_FOUNDER_IMAGE);

  const sectionRef = useRef<HTMLDivElement>(null);
  const philosophyRef = useRef<HTMLDivElement>(null);
  const narrativeRef = useRef<HTMLDivElement>(null);

  // Scroll triggers for section parallax
  const { scrollYProgress: philosophyProgress } = useScroll({
    target: philosophyRef,
    offset: ['start end', 'end start'],
  });

  const { scrollYProgress: narrativeProgress } = useScroll({
    target: narrativeRef,
    offset: ['start end', 'end start'],
  });

  // Smooth springs for fluid editorial motion
  const smoothPhilosophy = useSpring(philosophyProgress, { stiffness: 80, damping: 25 });
  const smoothNarrative = useSpring(narrativeProgress, { stiffness: 80, damping: 25 });

  // Transforms for philosophy floating text
  const philosophyY = useTransform(smoothPhilosophy, [0, 1], [50, -30]);
  const quoteY = useTransform(smoothPhilosophy, [0, 1], [70, -40]);

  // Transforms for narrative grid
  const imgY = useTransform(smoothNarrative, [0, 1], [40, -30]);
  const textY = useTransform(smoothNarrative, [0, 1], [80, -20]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleImageError = () => {
    if (imageSrc !== LOCAL_FOUNDER_IMAGE) {
      setImageSrc(LOCAL_FOUNDER_IMAGE);
    }
  };

  return (
    <section
      id="about-us"
      ref={sectionRef}
      className="w-full py-16 sm:py-24 bg-transparent text-[var(--text-primary)] transition-colors duration-500 relative overflow-hidden"
    >
      <div className="max-w-6xl mx-auto px-6 sm:px-8 space-y-20 sm:space-y-28">
        {/* Philosophy Masthead */}
        <div ref={philosophyRef} className="max-w-3xl mx-auto text-center space-y-5">
          <motion.div style={{ y: philosophyY }}>
            <span className="text-xs lowercase tracking-wider text-[var(--border-maroon)] font-bold block mb-2">
              about us & philosophy
            </span>

            <h2 className="text-xl sm:text-2xl font-bold lowercase tracking-wider text-[var(--text-dominant)]">
              some things stay.
            </h2>
          </motion.div>

          <motion.p
            style={{ y: quoteY }}
            className="text-[var(--text-primary)] text-[17px] text-center leading-relaxed font-normal italic lowercase font-sans"
          >
            in a world where everything moves too fast and gets replaced before it even gets worn in, matilda is built for the quiet stuff that sticks around. jewelry isn't meant to sit in a box waiting for a "special occasion". it is meant to live on your skin through tuesday mornings, late nights, spilled coffee and eventually, the piece stops feeling like something you bought and starts feeling like a piece of who you are. some things stay.
          </motion.p>
        </div>

        {/* Founder & Studio Narrative Grid */}
        <div ref={narrativeRef} className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12 items-center pt-4">
          {/* Permanent Founder Image */}
          <motion.div style={{ y: imgY }} className="md:col-span-5">
            <div className="relative w-full flex items-center justify-center overflow-hidden rounded-2xl border border-[var(--border-main)]/30 bg-[var(--card-bg)] shadow-sm">
              <img
                src={imageSrc}
                alt="Duha Ajaz Pandith, Founder & Creative Head"
                loading="eager"
                decoding="async"
                onError={handleImageError}
                className="w-full h-auto max-h-[580px] object-contain rounded-2xl"
                referrerPolicy="no-referrer"
              />
            </div>
          </motion.div>

          {/* Story Narrative with Parallax Float */}
          <motion.div style={{ y: textY }} className="md:col-span-7 space-y-5">
            <span className="text-xs lowercase tracking-wider text-[var(--border-maroon)] font-bold block">
              founder
            </span>

            <h3 className="text-base sm:text-lg font-bold tracking-wider text-[var(--text-dominant)]">
              meet Duha
            </h3>

            <div className="text-sm text-[var(--text-primary)] leading-relaxed font-normal space-y-4">
              <p className="text-[15px] text-[var(--text-dominant)] font-medium">
                matilda was founded by Duha Ajaz Pandith.
              </p>
              <p>
                she named it after MATILDA from the necklace: a tale centered on yearning for beauty. yet Duha set out to reshape that story. rather than reserving jewellery strictly for "special events" or pursuing an elusive ideal of luxury, MATILDA centers on discovering genuine, quiet bliss within life’s subtle daily moments.
              </p>
              <p className="italic text-[var(--accent-script)] pt-1">
                each piece serves as a simple invitation to cherish everything surrounding you today.
              </p>
            </div>

            <div className="pt-4 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-3">
                <span className="text-[var(--text-muted)] lowercase">est. 2025</span>
              </div>

              <button
                onClick={scrollToTop}
                className="text-xs text-[var(--border-maroon)] hover:text-[var(--text-dominant)] font-semibold lowercase flex items-center gap-1.5 transition-all group"
              >
                <span>back to top</span>
                <ArrowUp className="w-3.5 h-3.5 transition-transform group-hover:-translate-y-0.5" />
              </button>
            </div>
          </motion.div>
        </div>

        {/* Bottom Store Entry CTA Banner */}
        <div className="pt-10 text-center space-y-5">
          <h3 className="text-xl sm:text-2xl font-matilda lowercase tracking-tight text-[var(--text-dominant)]">
            explore the store
          </h3>

          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => openShop('women')}
              className="inline-flex items-center gap-2 px-7 py-2.5 rounded-full bg-[var(--border-maroon)] text-white text-xs font-medium lowercase tracking-wide hover:bg-[var(--text-dominant)] transition-all shadow-xs"
            >
              <span>women</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => openShop('men')}
              className="inline-flex items-center gap-2 px-7 py-2.5 rounded-full bg-[var(--border-maroon)] text-white text-xs font-medium lowercase tracking-wide hover:bg-[var(--text-dominant)] transition-all shadow-xs"
            >
              <span>men</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

