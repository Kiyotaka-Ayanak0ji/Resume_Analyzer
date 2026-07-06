"""In-house resume vs job description matching engine.

Two free modes:
  - quick: TF-IDF keyword matching + weighted skill coverage
  - deep:  quick + local sentence-transformer embeddings for semantic alignment

Skill weights and synonyms are trainable via user feedback (stored in MongoDB).
"""
import re
import logging
import threading

logger = logging.getLogger(__name__)

_model = None
_model_lock = threading.Lock()
_model_loading = False


def preload_model():
    """Load the sentence-transformer model (call in background thread at startup)."""
    global _model, _model_loading
    with _model_lock:
        if _model is not None or _model_loading:
            return
        _model_loading = True
    try:
        from sentence_transformers import SentenceTransformer
        m = SentenceTransformer("all-MiniLM-L6-v2")
        globals()["_model"] = m
        logger.info("Embeddings model loaded")
    except Exception as e:
        logger.error(f"Failed to load embeddings model: {e}")
    finally:
        globals()["_model_loading"] = False


def get_model():
    global _model
    if _model is None:
        preload_model()
    return _model


def normalize(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^\w\s\+\#\./-]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def extract_skills(text: str, skill_weights: dict, synonyms: dict):
    """Return the set of canonical skills found in the text."""
    norm = " " + normalize(text) + " "
    found = set()
    for s in skill_weights.keys():
        pattern = r"(?<![\w])" + re.escape(s) + r"(?![\w])"
        if re.search(pattern, norm):
            found.add(s)
    for syn, canonical in synonyms.items():
        pattern = r"(?<![\w])" + re.escape(syn.lower()) + r"(?![\w])"
        if re.search(pattern, norm) and canonical in skill_weights:
            found.add(canonical)
    return found


def detect_sections(resume_text: str):
    """Plain checks for common resume sections and quality signals."""
    norm = normalize(resume_text)
    checks = {
        "summary": bool(re.search(r"\b(summary|objective|profile|about me)\b", norm)),
        "experience": bool(re.search(r"\b(experience|employment|work history|career)\b", norm)),
        "education": bool(re.search(r"\b(education|degree|university|college|b\.s\.|m\.s\.|bachelor|master|phd)\b", norm)),
        "skills_section": bool(re.search(r"\b(skills|technologies|competencies|tech stack)\b", norm)),
        "contact": bool(re.search(r"(@|\bemail\b|\bphone\b|linkedin)", norm)),
        "has_numbers": bool(re.search(r"\d+\s*(%|percent|\+|k\b|users|customers|requests|hours|projects|people|engineers|million|m\b)", norm)),
    }
    return checks


def estimate_years_experience(text: str):
    norm = normalize(text)
    matches = re.findall(r"(\d{1,2})\+?\s*(?:years?|yrs?)", norm)
    if matches:
        try:
            return max(int(m) for m in matches if int(m) < 50)
        except ValueError:
            return None
    return None


def tfidf_cosine(resume_text: str, jd_text: str) -> float:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    try:
        vec = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), sublinear_tf=True)
        m = vec.fit_transform([normalize(resume_text), normalize(jd_text)])
        return float(cosine_similarity(m[0], m[1])[0][0])
    except ValueError:
        return 0.0


def top_jd_terms(jd_text: str, resume_text: str, limit=12):
    """JD's most important terms and whether the resume covers them."""
    from sklearn.feature_extraction.text import TfidfVectorizer
    try:
        vec = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), max_features=400)
        m = vec.fit_transform([normalize(jd_text)])
        scores = m.toarray()[0]
        terms = vec.get_feature_names_out()
        ranked = sorted(zip(terms, scores), key=lambda x: -x[1])
        resume_norm = " " + normalize(resume_text) + " "
        out = []
        for term, score in ranked[:limit]:
            covered = term in resume_norm
            out.append({"term": term, "importance": round(float(score), 3), "in_resume": covered})
        return out
    except ValueError:
        return []


def score_label(score: float) -> str:
    if score >= 75:
        return "Strong match"
    if score >= 50:
        return "Decent match"
    return "Needs work"


def build_suggestions(missing_skills, sections, resume_text, jd_text):
    suggestions = []
    if missing_skills:
        top_missing = sorted(missing_skills)[:5]
        suggestions.append({
            "title": "Add the skills this job asks for",
            "detail": f"The job mentions {', '.join(top_missing)} but your resume doesn't. If you have experience with any of these, add them - ideally with a real example.",
        })
    if not sections["has_numbers"]:
        suggestions.append({
            "title": "Add numbers to your achievements",
            "detail": "Results with numbers stand out. For example: 'cut load time by 40%' or 'supported 10k users' instead of 'improved performance'.",
        })
    if not sections["summary"]:
        suggestions.append({
            "title": "Add a short summary at the top",
            "detail": "2-3 lines that say who you are and what you're best at. Recruiters read this first.",
        })
    if not sections["skills_section"]:
        suggestions.append({
            "title": "Add a dedicated skills section",
            "detail": "A clear skills list helps both software filters and human reviewers find your strengths fast.",
        })
    word_count = len(resume_text.split())
    if word_count < 120:
        suggestions.append({
            "title": "Your resume looks short",
            "detail": f"At about {word_count} words, there may not be enough detail. Add specifics about what you did and the results.",
        })
    elif word_count > 1100:
        suggestions.append({
            "title": "Consider trimming your resume",
            "detail": "Long resumes lose attention. Keep the most relevant experience for this job and cut the rest.",
        })
    jd_years = estimate_years_experience(jd_text)
    resume_years = estimate_years_experience(resume_text)
    if jd_years and resume_years and resume_years < jd_years:
        suggestions.append({
            "title": "Experience gap to address",
            "detail": f"The job asks for about {jd_years} years of experience; your resume shows around {resume_years}. Highlight depth of impact to compensate.",
        })
    if not suggestions:
        suggestions.append({
            "title": "Looking good",
            "detail": "Your resume covers this job well. Double-check the wording matches the job post (same terms) to pass automated filters.",
        })
    return suggestions


def quick_analyze(resume_text: str, jd_text: str, skill_weights: dict, synonyms: dict):
    resume_skills = extract_skills(resume_text, skill_weights, synonyms)
    jd_skills = extract_skills(jd_text, skill_weights, synonyms)
    matched = resume_skills & jd_skills
    missing = jd_skills - resume_skills
    extra = resume_skills - jd_skills

    if jd_skills:
        total_w = sum(skill_weights.get(s, 1.0) for s in jd_skills)
        matched_w = sum(skill_weights.get(s, 1.0) for s in matched)
        skill_cov = matched_w / total_w if total_w > 0 else 0.0
    else:
        skill_cov = 0.5  # neutral when JD has no recognizable skills

    cos = tfidf_cosine(resume_text, jd_text)
    keyword_signal = min(cos * 2.5, 1.0)
    breadth = min(len(matched) / 10, 1.0)

    score = round((0.5 * skill_cov + 0.3 * keyword_signal + 0.2 * breadth) * 100, 1)
    score = max(0.0, min(100.0, score))

    sections = detect_sections(resume_text)
    terms = top_jd_terms(jd_text, resume_text)
    suggestions = build_suggestions(missing, sections, resume_text, jd_text)

    return {
        "score": score,
        "label": score_label(score),
        "skill_coverage": round(skill_cov * 100, 1),
        "keyword_similarity": round(cos, 4),
        "matched_skills": sorted(matched),
        "missing_skills": sorted(missing),
        "extra_skills": sorted(extra)[:15],
        "sections": sections,
        "top_jd_terms": terms,
        "suggestions": suggestions,
    }


def deep_analyze(resume_text: str, jd_text: str, skill_weights: dict, synonyms: dict):
    """Quick analysis + semantic similarity via local embeddings."""
    result = quick_analyze(resume_text, jd_text, skill_weights, synonyms)
    model = get_model()
    if model is None:
        result["semantic_available"] = False
        return result

    from sentence_transformers import util

    doc_emb = model.encode([resume_text[:4000], jd_text[:4000]], normalize_embeddings=True)
    overall = float(util.cos_sim(doc_emb[0], doc_emb[1])[0][0])

    jd_lines = [l.strip("-• \t").strip() for l in jd_text.split("\n") if len(l.strip()) > 25][:30]
    resume_lines = [l.strip("-• \t").strip() for l in resume_text.split("\n") if len(l.strip()) > 25][:60]

    alignments = []
    if jd_lines and resume_lines:
        jd_emb = model.encode(jd_lines, normalize_embeddings=True)
        r_emb = model.encode(resume_lines, normalize_embeddings=True)
        sims = util.cos_sim(jd_emb, r_emb)
        for i, jl in enumerate(jd_lines):
            best_j = int(sims[i].argmax())
            sim = float(sims[i][best_j])
            alignments.append({
                "jd_requirement": jl[:220],
                "resume_evidence": resume_lines[best_j][:220],
                "similarity": round(sim, 3),
                "strength": "strong" if sim >= 0.55 else ("partial" if sim >= 0.35 else "weak"),
            })
        alignments.sort(key=lambda a: -a["similarity"])

    semantic_signal = max(0.0, min((overall - 0.2) / 0.6, 1.0))
    combined = round(
        0.40 * (result["skill_coverage"] / 100)
        + 0.35 * semantic_signal
        + 0.15 * min(result["keyword_similarity"] * 2.5, 1.0)
        + 0.10 * min(len(result["matched_skills"]) / 10, 1.0),
        3,
    ) * 100
    combined = max(0.0, min(100.0, round(combined, 1)))

    weak_reqs = [a for a in alignments if a["strength"] == "weak"][:3]
    if weak_reqs:
        result["suggestions"].insert(0, {
            "title": "Some job requirements have no matching evidence",
            "detail": "These parts of the job post don't clearly map to anything in your resume: "
                      + " | ".join(f'"{w["jd_requirement"][:80]}"' for w in weak_reqs)
                      + ". Add a line about each if you have that experience.",
        })

    result.update({
        "score": combined,
        "label": score_label(combined),
        "semantic_available": True,
        "semantic_similarity": round(overall, 4),
        "alignments": alignments[:12],
    })
    return result
