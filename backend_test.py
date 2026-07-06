"""Comprehensive backend API tests for Resume Screener application."""
import requests
import sys
import time
from datetime import datetime

BASE_URL = "https://job-fit-analyzer-68.preview.emergentagent.com/api"

class APITester:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.token_a = None
        self.token_b = None
        self.user_a_id = None
        self.user_b_id = None
        self.resume_ids = []
        self.analysis_ids = []
        
    def test(self, name, method, endpoint, expected_status, data=None, headers=None, files=None):
        """Run a single API test."""
        url = f"{BASE_URL}{endpoint}"
        h = headers or {}
        if not h.get('Content-Type') and not files:
            h['Content-Type'] = 'application/json'
        
        self.tests_run += 1
        print(f"\n🔍 Test {self.tests_run}: {name}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=h, timeout=30)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files, data=data, headers={k:v for k,v in h.items() if k != 'Content-Type'}, timeout=30)
                else:
                    response = requests.post(url, json=data, headers=h, timeout=30)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=h, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=h, timeout=30)
            else:
                print(f"❌ FAILED - Unknown method: {method}")
                return False, {}
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ PASSED - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                print(f"❌ FAILED - Expected {expected_status}, got {response.status_code}")
                try:
                    print(f"   Response: {response.json()}")
                except:
                    print(f"   Response: {response.text[:200]}")
                return False, {}
        except Exception as e:
            print(f"❌ FAILED - Error: {str(e)}")
            return False, {}
    
    def auth_header(self, token):
        """Return authorization header."""
        return {'Authorization': f'Bearer {token}'}
    
    def run_all_tests(self):
        """Run all backend tests."""
        print("=" * 60)
        print("RESUME SCREENER - BACKEND API TESTS")
        print("=" * 60)
        
        # ============ AUTH TESTS ============
        print("\n" + "=" * 60)
        print("AUTH TESTS")
        print("=" * 60)
        
        # Test 1: Register new user A
        timestamp = int(time.time())
        email_a = f"testuser_a_{timestamp}@example.com"
        success, resp = self.test(
            "Register new user A",
            "POST", "/auth/register", 200,
            data={"name": "Test User A", "email": email_a, "password": "testpass123"}
        )
        if success and resp.get('token'):
            self.token_a = resp['token']
            self.user_a_id = resp['user']['id']
        
        # Test 2: Login with existing test user
        success, resp = self.test(
            "Login with existing test user",
            "POST", "/auth/login", 200,
            data={"email": "test@example.com", "password": "testpass123"}
        )
        if success and resp.get('token'):
            # Use this as user B for isolation testing
            self.token_b = resp['token']
            self.user_b_id = resp['user']['id']
        
        # Test 3: GET /auth/me with valid token
        if self.token_a:
            self.test(
                "GET /auth/me with valid token",
                "GET", "/auth/me", 200,
                headers=self.auth_header(self.token_a)
            )
        
        # Test 4: GET /auth/me without token (should fail)
        self.test(
            "GET /auth/me without token (should return 401)",
            "GET", "/auth/me", 401
        )
        
        # Test 5: Login with wrong password
        self.test(
            "Login with wrong password (should return 401)",
            "POST", "/auth/login", 401,
            data={"email": "test@example.com", "password": "wrongpassword"}
        )
        
        # Test 6: Register duplicate email
        self.test(
            "Register duplicate email (should return 409)",
            "POST", "/auth/register", 409,
            data={"name": "Duplicate", "email": email_a, "password": "testpass123"}
        )
        
        # Test 7: Google auth config (should show disabled)
        success, resp = self.test(
            "GET /auth/config (Google should be disabled)",
            "GET", "/auth/config", 200
        )
        if success:
            if not resp.get('google_enabled'):
                print("   ✓ Google OAuth correctly disabled")
            else:
                print("   ⚠ Warning: Google OAuth appears enabled but should be disabled")
        
        # ============ RESUMES TESTS ============
        print("\n" + "=" * 60)
        print("RESUMES TESTS")
        print("=" * 60)
        
        if not self.token_a:
            print("⚠ Skipping resume tests - no auth token")
            return
        
        # Test 8: Create resume 1
        resume_text_1 = """John Doe
Senior Software Engineer
john@example.com | linkedin.com/in/johndoe

SUMMARY
Experienced software engineer with 5+ years in Python, JavaScript, and cloud technologies.

EXPERIENCE
Senior Software Engineer at Tech Corp (2020-2024)
- Built scalable APIs using FastAPI and PostgreSQL
- Implemented CI/CD pipelines with Docker and Kubernetes
- Led team of 4 engineers, improved deployment speed by 60%

Software Engineer at StartupXYZ (2018-2020)
- Developed React frontend applications
- Integrated payment systems (Stripe, PayPal)
- Reduced page load time by 40%

EDUCATION
B.S. Computer Science, University of Technology (2018)

SKILLS
Python, JavaScript, React, FastAPI, PostgreSQL, Docker, Kubernetes, AWS, Git, CI/CD
"""
        success, resp = self.test(
            "Create resume 1",
            "POST", "/resumes", 200,
            data={"label": "Backend Engineer Resume", "text": resume_text_1},
            headers=self.auth_header(self.token_a)
        )
        if success and resp.get('id'):
            self.resume_ids.append(resp['id'])
            print(f"   ✓ Resume ID: {resp['id']}, Skills detected: {len(resp.get('skills', []))}")
        
        # Test 9: Create resume 2
        resume_text_2 = """Jane Smith
Full Stack Developer
jane@example.com

SUMMARY
Full stack developer with expertise in Node.js, React, and MongoDB.

EXPERIENCE
Full Stack Developer at WebCo (2019-2024)
- Built e-commerce platform serving 50k+ users
- Implemented real-time chat with WebSockets
- Optimized database queries, reduced response time by 35%

EDUCATION
M.S. Computer Science, Tech University (2019)

SKILLS
Node.js, React, MongoDB, Express, TypeScript, GraphQL, Redis, AWS Lambda
"""
        success, resp = self.test(
            "Create resume 2",
            "POST", "/resumes", 200,
            data={"label": "Full Stack Resume", "text": resume_text_2},
            headers=self.auth_header(self.token_a)
        )
        if success and resp.get('id'):
            self.resume_ids.append(resp['id'])
        
        # Test 10: Create resume 3
        resume_text_3 = """Bob Johnson
DevOps Engineer
bob@example.com

SUMMARY
DevOps engineer specializing in cloud infrastructure and automation.

EXPERIENCE
DevOps Engineer at CloudTech (2020-2024)
- Managed AWS infrastructure for 100+ microservices
- Automated deployments with Terraform and Ansible
- Reduced infrastructure costs by 30%

SKILLS
AWS, Terraform, Ansible, Docker, Kubernetes, Jenkins, Python, Bash, Monitoring
"""
        success, resp = self.test(
            "Create resume 3",
            "POST", "/resumes", 200,
            data={"label": "DevOps Resume", "text": resume_text_3},
            headers=self.auth_header(self.token_a)
        )
        if success and resp.get('id'):
            self.resume_ids.append(resp['id'])
        
        # Test 11: Try to create 4th resume (should fail with 409)
        self.test(
            "Create 4th resume (should return 409 - limit reached)",
            "POST", "/resumes", 409,
            data={"label": "Extra Resume", "text": resume_text_1},
            headers=self.auth_header(self.token_a)
        )
        
        # Test 12: List resumes
        success, resp = self.test(
            "GET /resumes",
            "GET", "/resumes", 200,
            headers=self.auth_header(self.token_a)
        )
        if success:
            print(f"   ✓ Found {len(resp)} resumes")
        
        # Test 13: PATCH resume - set default
        if len(self.resume_ids) >= 2:
            success, resp = self.test(
                "PATCH resume - set as default",
                "PATCH", f"/resumes/{self.resume_ids[1]}", 200,
                data={"is_default": True},
                headers=self.auth_header(self.token_a)
            )
            if success and resp.get('is_default'):
                print("   ✓ Resume set as default")
        
        # Test 14: Upload resume file (create a .txt file)
        test_file_content = """Test Resume Upload
Software Engineer with Python and JavaScript experience.
Skills: Python, JavaScript, React, FastAPI, Docker, Kubernetes, AWS, PostgreSQL
Experience: 3 years in web development and cloud infrastructure.
"""
        success, resp = self.test(
            "POST /resumes/upload with .txt file",
            "POST", "/resumes/upload", 409,  # Should fail due to 3-resume limit
            files={'file': ('test_resume.txt', test_file_content.encode(), 'text/plain')},
            data={'label': 'Uploaded Resume'},
            headers=self.auth_header(self.token_a)
        )
        
        # Test 15: Parse file without saving
        success, resp = self.test(
            "POST /parse-file",
            "POST", "/parse-file", 200,
            files={'file': ('test_resume.txt', test_file_content.encode(), 'text/plain')},
            headers=self.auth_header(self.token_a)
        )
        if success:
            print(f"   ✓ Parsed text length: {len(resp.get('text', ''))}, Skills: {len(resp.get('skills', []))}")
            if resp.get('from_cache'):
                print("   ✓ Resume loaded from cache")
        
        # Test 16: DELETE resume
        if len(self.resume_ids) >= 1:
            success, resp = self.test(
                "DELETE resume",
                "DELETE", f"/resumes/{self.resume_ids[0]}", 200,
                headers=self.auth_header(self.token_a)
            )
            if success:
                self.resume_ids.pop(0)
        
        # ============ ANALYSIS TESTS ============
        print("\n" + "=" * 60)
        print("ANALYSIS TESTS")
        print("=" * 60)
        
        jd_text = """Senior Backend Engineer
We're looking for a Senior Backend Engineer to join our team.

Requirements:
- 5+ years of experience in backend development
- Strong proficiency in Python and FastAPI
- Experience with PostgreSQL and database optimization
- Knowledge of Docker and Kubernetes
- Experience with AWS cloud services
- Strong understanding of CI/CD pipelines
- Experience leading engineering teams
- Excellent problem-solving skills

Responsibilities:
- Design and implement scalable backend APIs
- Optimize database queries and performance
- Mentor junior engineers
- Collaborate with frontend team
- Ensure code quality and best practices

Nice to have:
- Experience with microservices architecture
- Knowledge of Redis caching
- GraphQL experience
"""
        
        # Test 17: Quick mode analysis
        print("\n⏱ Running quick mode analysis...")
        success, resp = self.test(
            "POST /analyze with mode=quick",
            "POST", "/analyze", 200,
            data={
                "resume_text": resume_text_1,
                "jd_text": jd_text,
                "mode": "quick"
            },
            headers=self.auth_header(self.token_a)
        )
        if success:
            self.analysis_ids.append(resp.get('id'))
            result = resp.get('result', {})
            print(f"   ✓ Score: {result.get('score')}, Label: {result.get('label')}")
            print(f"   ✓ Matched skills: {len(result.get('matched_skills', []))}")
            print(f"   ✓ Missing skills: {len(result.get('missing_skills', []))}")
            print(f"   ✓ Suggestions: {len(result.get('suggestions', []))}")
            print(f"   ✓ Top JD terms: {len(result.get('top_jd_terms', []))}")
            print(f"   ✓ Resume from cache: {resp.get('resume_from_cache', False)}")
        
        # Test 18: Deep mode analysis (may take 5-10s first time)
        print("\n⏱ Running deep mode analysis (may take 5-10s for first call)...")
        success, resp = self.test(
            "POST /analyze with mode=deep",
            "POST", "/analyze", 200,
            data={
                "resume_text": resume_text_1,
                "jd_text": jd_text,
                "mode": "deep"
            },
            headers=self.auth_header(self.token_a)
        )
        if success:
            self.analysis_ids.append(resp.get('id'))
            result = resp.get('result', {})
            print(f"   ✓ Score: {result.get('score')}, Label: {result.get('label')}")
            print(f"   ✓ Semantic similarity: {result.get('semantic_similarity')}")
            print(f"   ✓ Alignments: {len(result.get('alignments', []))}")
            print(f"   ✓ Resume from cache: {resp.get('resume_from_cache', False)}")
            if resp.get('resume_from_cache'):
                print("   ✓ Cache working - second analysis with same resume loaded from cache")
        
        # Test 19: Analysis with saved resume
        if len(self.resume_ids) >= 1:
            success, resp = self.test(
                "POST /analyze with saved resume_id",
                "POST", "/analyze", 200,
                data={
                    "resume_id": self.resume_ids[0],
                    "jd_text": jd_text,
                    "mode": "quick"
                },
                headers=self.auth_header(self.token_a)
            )
            if success:
                self.analysis_ids.append(resp.get('id'))
        
        # Test 20: GET analyses (history)
        success, resp = self.test(
            "GET /analyses (history list)",
            "GET", "/analyses", 200,
            headers=self.auth_header(self.token_a)
        )
        if success:
            print(f"   ✓ Found {len(resp)} analyses in history")
        
        # Test 21: GET analysis by ID
        if len(self.analysis_ids) >= 1:
            success, resp = self.test(
                "GET /analyses/{id}",
                "GET", f"/analyses/{self.analysis_ids[0]}", 200,
                headers=self.auth_header(self.token_a)
            )
            if success:
                print(f"   ✓ Retrieved analysis: {resp.get('id')}")
        
        # ============ FEEDBACK TESTS ============
        print("\n" + "=" * 60)
        print("FEEDBACK TESTS (Training Loop)")
        print("=" * 60)
        
        # Test 22: Submit feedback with skill corrections
        if len(self.analysis_ids) >= 1:
            success, resp = self.test(
                "POST /analyses/{id}/feedback with corrections",
                "POST", f"/analyses/{self.analysis_ids[0]}/feedback", 200,
                data={
                    "overall_accurate": True,
                    "skill_corrections": {"kubernetes": "incorrect", "python": "important"},
                    "missing_skills_to_add": ["customskill123", "testskill456"],
                    "comment": "Test feedback for training"
                },
                headers=self.auth_header(self.token_a)
            )
            if success:
                changes = resp.get('changes_applied', [])
                print(f"   ✓ Changes applied: {len(changes)}")
                for change in changes[:3]:
                    print(f"      - {change}")
        
        # Test 23: GET KB stats (should show increased skills_learned_from_feedback)
        success, resp = self.test(
            "GET /kb/stats (knowledge base stats)",
            "GET", "/kb/stats", 200
        )
        if success:
            print(f"   ✓ Skills known: {resp.get('skills_known')}")
            print(f"   ✓ Skills learned from feedback: {resp.get('skills_learned_from_feedback')}")
            print(f"   ✓ Cached resumes: {resp.get('cached_resumes')}")
            print(f"   ✓ Cache hits: {resp.get('cache_hits')}")
            print(f"   ✓ Feedback events: {resp.get('feedback_events')}")
        
        # Test 24: Run same analysis again to verify feedback changed results
        if len(self.analysis_ids) >= 1:
            print("\n⏱ Re-running analysis to verify feedback training...")
            success, resp = self.test(
                "POST /analyze again (after feedback training)",
                "POST", "/analyze", 200,
                data={
                    "resume_text": resume_text_1,
                    "jd_text": jd_text,
                    "mode": "quick"
                },
                headers=self.auth_header(self.token_a)
            )
            if success:
                result = resp.get('result', {})
                print(f"   ✓ New score after training: {result.get('score')}")
                # Check if custom skills were learned
                all_skills = result.get('matched_skills', []) + result.get('missing_skills', [])
                if 'customskill123' in all_skills or 'testskill456' in all_skills:
                    print("   ✓ Custom skills from feedback now detected!")
        
        # ============ SETTINGS TESTS ============
        print("\n" + "=" * 60)
        print("SETTINGS TESTS (AI Keys)")
        print("=" * 60)
        
        # Test 25: Save fake OpenAI key
        success, resp = self.test(
            "POST /settings/keys (save fake OpenAI key)",
            "POST", "/settings/keys", 200,
            data={
                "provider": "openai",
                "api_key": "sk-fake123456789testkey",
                "model": "gpt-4o-mini"
            },
            headers=self.auth_header(self.token_a)
        )
        if success:
            print(f"   ✓ Masked key: {resp.get('masked_key')}")
            print(f"   ✓ Model: {resp.get('model')}")
        
        # Test 26: GET saved keys
        success, resp = self.test(
            "GET /settings/keys",
            "GET", "/settings/keys", 200,
            headers=self.auth_header(self.token_a)
        )
        if success:
            print(f"   ✓ Found {len(resp)} saved keys")
            for key in resp:
                print(f"      - {key.get('provider')}: {key.get('masked_key')} (verified: {key.get('verified')})")
        
        # Test 27: Test connection with fake key (should fail with 502)
        success, resp = self.test(
            "POST /settings/keys/test (should fail with invalid key)",
            "POST", "/settings/keys/test", 502,
            data={"provider": "openai"},
            headers=self.auth_header(self.token_a)
        )
        if not success and resp:
            print("   ✓ Correctly returned error for invalid key")
        
        # Test 28: DELETE key
        success, resp = self.test(
            "DELETE /settings/keys/{provider}",
            "DELETE", "/settings/keys/openai", 200,
            headers=self.auth_header(self.token_a)
        )
        
        # ============ STATS TESTS ============
        print("\n" + "=" * 60)
        print("STATS TESTS")
        print("=" * 60)
        
        # Test 29: GET user stats
        success, resp = self.test(
            "GET /stats (user stats)",
            "GET", "/stats", 200,
            headers=self.auth_header(self.token_a)
        )
        if success:
            print(f"   ✓ Total analyses: {resp.get('total_analyses')}")
            print(f"   ✓ Average score: {resp.get('avg_score')}")
            print(f"   ✓ Best score: {resp.get('best_score')}")
            print(f"   ✓ Resume count: {resp.get('resume_count')}")
            print(f"   ✓ Trend data points: {len(resp.get('trend', []))}")
        
        # ============ USER ISOLATION TESTS ============
        print("\n" + "=" * 60)
        print("USER ISOLATION TESTS")
        print("=" * 60)
        
        # Test 30: User B tries to access User A's analysis (should return 404)
        if self.token_b and len(self.analysis_ids) >= 1:
            self.test(
                "User B tries to GET User A's analysis (should return 404)",
                "GET", f"/analyses/{self.analysis_ids[0]}", 404,
                headers=self.auth_header(self.token_b)
            )
        
        # Test 31: DELETE analysis
        if len(self.analysis_ids) >= 1:
            success, resp = self.test(
                "DELETE /analyses/{id}",
                "DELETE", f"/analyses/{self.analysis_ids[0]}", 200,
                headers=self.auth_header(self.token_a)
            )
            if success:
                self.analysis_ids.pop(0)
        
        # ============ HEALTH CHECK ============
        print("\n" + "=" * 60)
        print("HEALTH CHECK")
        print("=" * 60)
        
        # Test 32: Health endpoint
        success, resp = self.test(
            "GET /health",
            "GET", "/health", 200
        )
        if success:
            print(f"   ✓ Status: {resp.get('status')}")
        
        # ============ SUMMARY ============
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        print(f"Total tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success rate: {(self.tests_passed / self.tests_run * 100):.1f}%")
        print("=" * 60)
        
        return 0 if self.tests_passed == self.tests_run else 1

def main():
    tester = APITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())
