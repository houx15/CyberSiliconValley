from __future__ import annotations

from contracts.profile import EnterpriseProfilePatch, TalentProfilePatch


def test_talent_profile_patch_accepts_camel_case_payloads() -> None:
    payload = TalentProfilePatch.model_validate(
        {
            "displayName": "Alice",
            "headline": "AI Engineer",
            "salaryRange": {"min": 100, "currency": "USD"},
            "resumeUrl": "https://example.com/resume.pdf",
            "profileData": {"source": "frontend"},
            "onboardingDone": True,
        }
    )

    assert payload.display_name == "Alice"
    assert payload.salary_range == {"min": 100, "currency": "USD"}
    assert payload.resume_url == "https://example.com/resume.pdf"
    assert payload.profile_data == {"source": "frontend"}
    assert payload.onboarding_done is True


def test_enterprise_profile_patch_accepts_camel_case_payloads() -> None:
    payload = EnterpriseProfilePatch.model_validate(
        {
            "companyName": "CSV Labs",
            "companySize": "11-50",
            "aiMaturity": "growing",
            "profileData": {"source": "frontend"},
            "onboardingDone": True,
        }
    )

    assert payload.company_name == "CSV Labs"
    assert payload.company_size == "11-50"
    assert payload.ai_maturity == "growing"
    assert payload.profile_data == {"source": "frontend"}
    assert payload.onboarding_done is True
