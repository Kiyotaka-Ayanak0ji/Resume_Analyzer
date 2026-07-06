import { useEffect } from "react";

const BRAND = "Resume Decoded";
const DEFAULT_DESCRIPTION =
  "Free, open-source resume checker. Paste your resume and a job description to get an instant match score, missing skills and plain-language suggestions.";

/**
 * Lightweight per-page SEO: sets document title + meta description.
 * No extra dependencies needed for a CRA SPA.
 */
export const usePageSEO = (title, description) => {
  useEffect(() => {
    document.title = title ? `${title} | ${BRAND}` : `${BRAND} - Free Resume Checker & Job Match Analyzer`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", description || DEFAULT_DESCRIPTION);
    return () => {
      document.title = `${BRAND} - Free Resume Checker & Job Match Analyzer`;
      if (meta) meta.setAttribute("content", DEFAULT_DESCRIPTION);
    };
  }, [title, description]);
};
