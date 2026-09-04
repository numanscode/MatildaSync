import React, { useState } from 'react';
import { motion } from 'motion/react';

const DRIVE_FOUNDER_IMAGE = 'https://lh3.googleusercontent.com/d/1bY2b0Kvev6jag6XJiVTcbx2X5dV8Drl2';
const LOCAL_FOUNDER_IMAGE = '/mainsite.jpg';

export const FounderStory: React.FC = () => {
  const [imageSrc, setImageSrc] = useState<string>(DRIVE_FOUNDER_IMAGE);

  const handleImageError = () => {
    if (imageSrc !== LOCAL_FOUNDER_IMAGE) {
      setImageSrc(LOCAL_FOUNDER_IMAGE);
    }
  };

  return (
    <section className="w-full py-16 sm:py-24 bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-500">
      <div className="max-w-6xl mx-auto px-6 sm:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Founder Image */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="md:col-span-5"
          >
            <div className="relative aspect-4/5 w-full rounded-2xl overflow-hidden border border-[var(--border-main)] shadow-xl bg-[var(--card-bg)]">
              <img
                src={imageSrc}
                alt="Duha Ajaz Pandith, Founder & Creative Head"
                loading="eager"
                decoding="async"
                onError={handleImageError}
                className="w-full h-full object-cover transition-all duration-700"
                referrerPolicy="no-referrer"
              />
              <div className="absolute bottom-3 left-3 right-3 bg-[var(--bg-primary)]/90 backdrop-blur-md border border-[var(--border-main)] p-3 rounded-xl text-xs flex justify-between items-center shadow-xs">
                <span className="font-display font-bold tracking-normal text-[var(--text-dominant)]">
                  Duha Ajaz Pandith
                </span>
                <span className="text-[10px] text-[var(--border-maroon)] lowercase font-semibold">
                  founder & creative head
                </span>
              </div>
            </div>
          </motion.div>

          {/* Story Narrative */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="md:col-span-7 space-y-5"
          >
            <span className="text-xs lowercase tracking-wider text-[var(--border-maroon)] font-bold block">
              founder
            </span>

            <h2 className="text-base sm:text-lg font-bold tracking-wider text-[var(--text-dominant)]">
              meet Duha
            </h2>

            <p className="text-sm text-[var(--text-primary)] leading-relaxed font-medium">
              matilda was founded by Duha Ajaz Pandith.
            </p>

            <p className="text-sm text-[var(--text-primary)] leading-relaxed font-normal">
              she named it after MATILDA from the necklace: a tale centered on yearning for beauty. yet Duha set out to reshape that story. rather than reserving jewellery strictly for "special events" or pursuing an elusive ideal of luxury, MATILDA centers on discovering genuine, quiet bliss within life’s subtle daily moments.
            </p>

            <blockquote className="font-serif-italic text-base sm:text-lg border-l-2 border-[var(--border-maroon)] pl-4 text-[var(--accent-script)] italic leading-relaxed">
              "each piece serves as a simple invitation to cherish everything surrounding you today."
            </blockquote>

            <div className="pt-2 flex items-center gap-4 text-xs">
              <span className="px-3 py-1 rounded-full border border-[var(--border-main)] bg-[var(--card-bg)] text-[var(--text-dominant)] font-semibold lowercase">
                handcrafted in the valley
              </span>
              <span className="text-[var(--text-muted)] lowercase">est. 2025</span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
