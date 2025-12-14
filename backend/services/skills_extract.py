from __future__ import annotations

import re
from collections import Counter
from typing import Iterable
from services.llm_client import llm_client

# Common stopwords and non-skill words to filter out
STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
    "by", "from", "as", "is", "was", "are", "were", "been", "be", "have", "has", "had",
    "do", "does", "did", "will", "would", "could", "should", "may", "might", "must",
    "shall", "can", "need", "dare", "ought", "used", "it", "its", "this", "that",
    "these", "those", "i", "you", "he", "she", "we", "they", "what", "which", "who",
    "whom", "whose", "where", "when", "why", "how", "all", "each", "every", "both",
    "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own",
    "same", "so", "than", "too", "very", "just", "also", "now", "here", "there",
    "about", "into", "through", "during", "before", "after", "above", "below", "up",
    "down", "out", "off", "over", "under", "again", "further", "then", "once",
    # Job description common words that aren't skills
    "experience", "years", "year", "work", "working", "team", "teams", "role", "job",
    "position", "company", "business", "industry", "candidate", "candidates",
    "required", "requirements", "preferred", "skills", "skill", "ability", "abilities",
    "knowledge", "understanding", "familiarity", "proficiency", "proficient",
    "excellent", "strong", "good", "great", "best", "proven", "demonstrated",
    "responsible", "responsibilities", "looking", "seeking", "hiring", "join",
    "opportunity", "opportunities", "environment", "culture", "benefits", "salary",
    "plus", "bonus", "including", "includes", "include", "etc", "senior", "junior",
    "lead", "level", "manager", "engineer", "developer", "analyst", "specialist",
    "software", "engineering", "development", "developing", "building", "build",
}


async def extract_required_skills(title: str, description: str) -> list[str]:
    """Extract required skills using LLM with fallback to keyword extraction."""
    
    # Detect seniority level
    title_lower = title.lower()
    is_senior = any(level in title_lower for level in ["senior", "staff", "principal", "lead", "architect"])
    is_junior = any(level in title_lower for level in ["junior", "entry", "associate", "intern"])
    
    # Detect role type
    is_frontend = any(term in title_lower for term in ["frontend", "front-end", "front end", "ui", "react", "vue", "angular"])
    is_backend = any(term in title_lower for term in ["backend", "back-end", "back end", "server", "api"])
    is_fullstack = any(term in title_lower for term in ["fullstack", "full-stack", "full stack"])
    is_data = any(term in title_lower for term in ["data", "ml", "machine learning", "ai", "analytics"])
    is_devops = any(term in title_lower for term in ["devops", "sre", "platform", "infrastructure", "cloud"])
    
    seniority_context = ""
    if is_senior:
        seniority_context = "This is a SENIOR role - include advanced skills, architecture patterns, and leadership/mentoring abilities. "
    elif is_junior:
        seniority_context = "This is a junior role - focus on fundamental skills. "
    
    role_context = ""
    if is_frontend:
        role_context = "Focus on modern frontend: React/Vue/Angular, TypeScript, state management, testing, performance optimization, accessibility. "
    elif is_backend:
        role_context = "Focus on backend: APIs, databases, microservices, cloud services, system design. "
    elif is_fullstack:
        role_context = "Include both frontend and backend skills plus DevOps basics. "
    elif is_data:
        role_context = "Focus on data skills: Python, SQL, ML frameworks, data pipelines, statistics. "
    elif is_devops:
        role_context = "Focus on DevOps: CI/CD, containers, Kubernetes, cloud platforms, IaC, monitoring. "
    
    prompt = (
        f"Extract technical skills and technologies required for this job. "
        f"{seniority_context}{role_context}"
        "Return ONLY a JSON array of specific, modern skill names. "
        "Include frameworks (not just languages), tools, and methodologies. "
        "Example for Senior Frontend: [\"React\", \"TypeScript\", \"Next.js\", \"GraphQL\", \"Jest\", \"Webpack\", \"Performance Optimization\", \"System Design\"]"
    )
    
    content = f"Job Title: {title}"
    if description:
        content += f"\n\nJob Description: {description}"
    
    try:
        response = await llm_client.chat(
            prompt=prompt,
            system="Return ONLY a JSON array of skill strings. Include modern frameworks, not just basic languages. No other text.",
            messages=[{"role": "user", "content": content}],
            json_mode=True,
        )
        if isinstance(response, list):
            skills = [str(s).strip() for s in response if str(s).strip()]
            # Filter out any stopwords that slipped through
            skills = [s for s in skills if s.lower() not in STOPWORDS]
            if skills:
                return list(dict.fromkeys(skills))[:15]  # Limit to 15 skills
    except Exception:
        pass
    
    # Fallback: extract skills from title since description might be empty
    return fallback_skill_extract(title, description)


def fallback_skill_extract(title: str, description: str = "", top_k: int = 10) -> list[str]:
    """Fallback skill extraction using role-based skill sets."""
    title_lower = title.lower()
    text = f"{title} {description}".lower()
    
    # Detect seniority
    is_senior = any(level in title_lower for level in ["senior", "staff", "principal", "lead", "architect"])
    
    # Role-specific skill sets (modern, framework-focused)
    FRONTEND_SKILLS = [
        "React", "TypeScript", "Next.js", "Vue.js", "Angular", "Redux", "GraphQL",
        "Tailwind CSS", "Jest", "Cypress", "Webpack", "Vite", "Storybook",
        "Web Performance", "Accessibility (a11y)", "Responsive Design"
    ]
    FRONTEND_SENIOR_SKILLS = [
        "System Design", "Micro-frontends", "Design Systems", "Performance Optimization",
        "Team Leadership", "Code Review", "Technical Mentorship", "Architecture Patterns"
    ]
    
    BACKEND_SKILLS = [
        "Python", "Node.js", "Java", "Go", "PostgreSQL", "MongoDB", "Redis",
        "REST APIs", "GraphQL", "Docker", "AWS", "Microservices"
    ]
    BACKEND_SENIOR_SKILLS = [
        "System Design", "Distributed Systems", "API Design", "Database Optimization",
        "Kubernetes", "CI/CD", "Technical Leadership", "Architecture"
    ]
    
    FULLSTACK_SKILLS = [
        "React", "Node.js", "TypeScript", "PostgreSQL", "MongoDB", "Docker",
        "AWS", "REST APIs", "GraphQL", "Git", "CI/CD"
    ]
    
    DATA_SKILLS = [
        "Python", "SQL", "Pandas", "NumPy", "Scikit-learn", "TensorFlow", "PyTorch",
        "Apache Spark", "Airflow", "AWS", "Data Modeling", "ETL"
    ]
    
    DEVOPS_SKILLS = [
        "Docker", "Kubernetes", "Terraform", "AWS", "GCP", "Azure", "CI/CD",
        "GitHub Actions", "Jenkins", "Prometheus", "Grafana", "Linux", "Bash"
    ]
    
    GENERAL_SOFTWARE_SKILLS = [
        "Python", "Java", "JavaScript", "TypeScript", "SQL", "Git", "Docker",
        "AWS", "REST APIs", "Agile", "CI/CD", "Unit Testing"
    ]
    GENERAL_SENIOR_SKILLS = [
        "System Design", "Architecture", "Technical Leadership", "Code Review",
        "Mentorship", "Cross-functional Collaboration"
    ]
    
    # Determine which skill set to use based on title
    skills = []
    if any(term in title_lower for term in ["frontend", "front-end", "front end", "ui developer", "react", "vue", "angular"]):
        skills = FRONTEND_SKILLS.copy()
        if is_senior:
            skills.extend(FRONTEND_SENIOR_SKILLS)
    elif any(term in title_lower for term in ["backend", "back-end", "back end", "server", "api developer"]):
        skills = BACKEND_SKILLS.copy()
        if is_senior:
            skills.extend(BACKEND_SENIOR_SKILLS)
    elif any(term in title_lower for term in ["fullstack", "full-stack", "full stack"]):
        skills = FULLSTACK_SKILLS.copy()
        if is_senior:
            skills.extend(GENERAL_SENIOR_SKILLS)
    elif any(term in title_lower for term in ["data", "ml", "machine learning", "ai", "scientist", "analyst"]):
        skills = DATA_SKILLS.copy()
        if is_senior:
            skills.extend(["Statistical Analysis", "A/B Testing", "Technical Leadership"])
    elif any(term in title_lower for term in ["devops", "sre", "platform", "infrastructure", "cloud"]):
        skills = DEVOPS_SKILLS.copy()
        if is_senior:
            skills.extend(["Architecture", "Incident Management", "Technical Leadership"])
    else:
        # Generic software engineer
        skills = GENERAL_SOFTWARE_SKILLS.copy()
        if is_senior:
            skills.extend(GENERAL_SENIOR_SKILLS)
    
    # Return deduplicated skills
    return list(dict.fromkeys(skills))[:top_k]
