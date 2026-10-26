"""
Carriers and Products Reference Data Seed.
Licensed Kenyan Underwriters and standard product offerings based on published IRA filings.
"""

import logging
from typing import Any

from sqlmodel import Session, select

from app.models import Insurer, PricingStrategy, Product

logger = logging.getLogger(__name__)

INSURERS_DATA: list[dict[str, Any]] = [
    {
        "name": "Old Mutual General Insurance Kenya Ltd.",
        "email": "info@oldmutual.co.ke",
        "phone": "+254 20 2829000",
    },
    {
        "name": "Jubilee General Insurance Ltd.",
        "email": "talk2us@jubileekenya.com",
        "phone": "+254 20 3281000",
    },
    {
        "name": "Britam General Insurance (Kenya) Ltd.",
        "email": "contact@britam.com",
        "phone": "+254 703 094000",
    },
    {
        "name": "CIC General Insurance Ltd.",
        "email": "callc@cic.co.ke",
        "phone": "+254 20 2823000",
    },
    {
        "name": "APA Insurance Ltd.",
        "email": "customercare@apainsurance.org",
        "phone": "+254 20 2862000",
    },
    {
        "name": "ICEA LION General Insurance Ltd.",
        "email": "contactcentre@icealion.com",
        "phone": "+254 20 2750000",
    },
    {
        "name": "Heritage Insurance Company Ltd.",
        "email": "info@heritage.co.ke",
        "phone": "+254 20 2783000",
    },
    {
        "name": "GA Insurance Ltd.",
        "email": "info@gakenya.com",
        "phone": "+254 20 2711633",
    },
]

PRODUCTS_DATA: list[dict[str, Any]] = [
    # 1. Old Mutual
    {
        "insurer_name": "Old Mutual General Insurance Kenya Ltd.",
        "name": "Motor Private - Comprehensive",
        "class_of_insurance": "Motor Private",
        "pricing_strategy": PricingStrategy.FIXED_TIERED,
        "default_commission_rate": 10.0,
        "product_details": {
            "vehicle_details": {
                "registration_number": "<<text>>",
                "make": "<<text>>",
                "year_of_manufacture": "<<number>>",
                "sum_insured": "<<number>>",
            },
            "added_benefits": {
                "pvt": "<<boolean>>",
                "excess_protector": "<<boolean>>",
                "om_rescue_plus": "<<boolean>>",
                "passenger_liability": "<<boolean>>",
            },
            "excesses": {
                "Own Damage": "2.5% of value minimum KES 15,000, max KES 100,000",
                "Third Party Property": "KES 5,000",
                "Total Theft with device": "10% of vehicle value minimum KES 20,000",
                "Total Theft without device": "20% of vehicle value minimum KES 20,000",
            },
            "special_clauses": [
                "Including special perils",
                "Subject to annual vehicle valuation",
                "Geographical limits: Kenya",
            ],
        },
        "pricing_rules": {
            "tiers": [
                {"max": 1500000, "rate": 5.0, "min": 60000},
                {"max": 2500000, "rate": 4.0, "min": 75000},
                {"max": 3000000, "rate": 3.5, "min": 100000},
                {"max": 5000000, "rate": 3.25, "min": 0},
                {"max": None, "rate": 3.0, "min": 0},
            ],
            "high_end_threshold": 3000000,
        },
        "default_benefits_and_limits": "Comprehensive Cover, Windscreen limit KES 50,000, Radio Cassette KES 30,000, Towing KES 30,000",
        "default_excesses": "Own Damage 2.5% (min KES 15,000). Third Party Damage KES 5,000. Theft with anti-theft 10%.",
        "default_special_clauses": "Subject to Kenya Jurisdiction clause and annual valuation clause.",
    },
    {
        "insurer_name": "Old Mutual General Insurance Kenya Ltd.",
        "name": "Motor Private - Third Party Only (TPO)",
        "class_of_insurance": "Motor Third Party",
        "pricing_strategy": PricingStrategy.FIXED_TIERED,
        "default_commission_rate": 10.0,
        "product_details": {
            "excesses": {
                "Third Party Property Damage": "KES 5,000",
                "Third Party Bodily Injury": "Nil",
            },
            "special_clauses": [
                "Statutory Third Party Risks Act (Cap 405) compliance",
                "No own damage or theft indemnity",
            ],
        },
        "pricing_rules": {
            "flat_annual_tariff": 7500,
        },
        "default_benefits_and_limits": "Statutory Third Party cover: Unlimited bodily injury/death, Third Party Property Damage up to KES 3,000,000.",
        "default_excesses": "Third Party Property Damage KES 5,000.",
        "default_special_clauses": "Cover restricted to Third Party liabilities as mandated by Cap 405.",
    },
    {
        "insurer_name": "Old Mutual General Insurance Kenya Ltd.",
        "name": "Commercial Vehicle Third Party Only",
        "class_of_insurance": "Motor Commercial Third Party",
        "pricing_strategy": PricingStrategy.FIXED_TIERED,
        "default_commission_rate": 10.0,
        "product_details": {
            "excesses": {
                "Third Party Property Damage": "KES 10,000",
                "Third Party Bodily Injury": "Nil",
            },
        },
        "pricing_rules": {
            "flat_annual_tariff": 12500,
        },
        "default_benefits_and_limits": "Commercial Vehicle Statutory Third Party cover: Third Party Property Damage up to KES 5,000,000.",
        "default_excesses": "Third Party Property Damage KES 10,000.",
        "default_special_clauses": "Commercial carriage of own goods/cartage statutory third party liability.",
    },
    {
        "insurer_name": "Old Mutual General Insurance Kenya Ltd.",
        "name": "Commercial Own Goods Comprehensive",
        "class_of_insurance": "Motor Commercial",
        "pricing_strategy": PricingStrategy.PERCENTAGE,
        "default_commission_rate": 10.0,
        "product_details": {
            "excesses": {
                "Own Damage": "5.0% of vehicle value minimum KES 25,000",
                "Third Party Property": "KES 10,000",
            },
            "special_clauses": [
                "Use restricted to carriage of own goods only",
                "Warranted vehicle fitted with approved speed governor",
            ],
        },
        "pricing_rules": {
            "rate": 4.5,
            "min_premium": 50000,
        },
        "default_benefits_and_limits": "Commercial Own Goods, Towing limit KES 50,000, Windscreen limit KES 50,000",
        "default_excesses": "5% of sum insured minimum KES 25,000 on Own Damage.",
        "default_special_clauses": "Speed governor warranty and authorized driver clause applicable.",
    },
    {
        "insurer_name": "Old Mutual General Insurance Kenya Ltd.",
        "name": "Domestic Package (Homeowners)",
        "class_of_insurance": "Domestic Package",
        "pricing_strategy": PricingStrategy.PERCENTAGE,
        "default_commission_rate": 20.0,
        "product_details": {
            "sections": [
                "Section A: Buildings",
                "Section B: Household Contents",
                "Section C: All Risks / Portable Valuables",
                "Section D: Domestic Servants (WIBA)",
                "Section E: Owners & Occupiers Liability",
            ]
        },
        "pricing_rules": {
            "buildings_rate": 0.12,
            "contents_rate": 0.85,
            "all_risks_rate": 1.75,
            "servant_flat_fee": 1200,
            "liability_free_limit": 2000000,
        },
        "default_benefits_and_limits": "Full domestic peril coverage including fire, storm, burst water pipes, and burglary.",
        "default_excesses": "KES 5,000 on burglary and special perils. Nil on fire.",
        "default_special_clauses": "First loss basis on contents up to 100% declared value.",
    },
    {
        "insurer_name": "Old Mutual General Insurance Kenya Ltd.",
        "name": "Afya Imara Family Health",
        "class_of_insurance": "Medical",
        "pricing_strategy": PricingStrategy.FIXED_TIERED,
        "default_commission_rate": 10.0,
        "product_details": {
            "tiers": ["Tier 1 (1M)", "Tier 2 (2M)", "Tier 3 (5M)"],
            "features": [
                "Direct cashless admission across Kenya",
                "Chronic condition cover within inpatient limit",
                "Optional Outpatient, Dental and Optical riders",
            ],
        },
        "pricing_rules": {
            "inpatient_rates": {
                "1000000": {
                    "M": 32000,
                    "M+1": 48000,
                    "M+2": 62000,
                    "M+3": 75000,
                    "M+4": 88000,
                },
                "2000000": {
                    "M": 45000,
                    "M+1": 68000,
                    "M+2": 88000,
                    "M+3": 105000,
                    "M+4": 120000,
                },
                "5000000": {
                    "M": 68000,
                    "M+1": 98000,
                    "M+2": 128000,
                    "M+3": 152000,
                    "M+4": 175000,
                },
            }
        },
        "default_benefits_and_limits": "Annual inpatient limit per family. Pre-existing conditions covered up to 50% after 1 year waiting period.",
        "default_excesses": "Nil on inpatient hospital bills within direct billing network.",
        "default_special_clauses": "Medical policies do not require Risk Notes. Governed strictly by carrier underwriting terms.",
    },
    # 2. Jubilee Insurance
    {
        "insurer_name": "Jubilee General Insurance Ltd.",
        "name": "Motor Private - Supreme Cover",
        "class_of_insurance": "Motor Private",
        "pricing_strategy": PricingStrategy.FIXED_TIERED,
        "default_commission_rate": 10.0,
        "product_details": {
            "excesses": {
                "Own Damage": "2.5% minimum KES 15,000",
                "Third Party": "KES 5,000",
            }
        },
        "pricing_rules": {
            "tiers": [
                {"max": 1500000, "rate": 5.0, "min": 65000},
                {"max": 2500000, "rate": 4.25, "min": 75000},
                {"max": 4000000, "rate": 3.75, "min": 105000},
                {"max": None, "rate": 3.25, "min": 0},
            ],
            "high_end_threshold": 3000000,
        },
        "default_benefits_and_limits": "Windscreen KES 50,000, Towing KES 30,000, Radio KES 30,000. Free AA rescue in Nairobi & Mombasa.",
        "default_excesses": "Own Damage 2.5% (min KES 15,000). Total theft 10% with tracking device.",
        "default_special_clauses": "Subject to Kenya Jurisdiction and approved repairer clause.",
    },
    {
        "insurer_name": "Jubilee General Insurance Ltd.",
        "name": "Cover All - Homeowners & Tenants",
        "class_of_insurance": "Domestic Package",
        "pricing_strategy": PricingStrategy.PERCENTAGE,
        "default_commission_rate": 20.0,
        "product_details": {"sections": ["Buildings", "Contents", "All Risks", "WIBA"]},
        "pricing_rules": {
            "buildings_rate": 0.10,
            "contents_rate": 0.75,
            "all_risks_rate": 1.50,
            "servant_flat_fee": 1000,
        },
        "default_benefits_and_limits": "Comprehensive domestic property protection with optional tenant liability cover.",
        "default_excesses": "KES 5,000 on burglary.",
        "default_special_clauses": "Average condition applies if under-insured.",
    },
    {
        "insurer_name": "Jubilee General Insurance Ltd.",
        "name": "J-Care Individual & Family Medical",
        "class_of_insurance": "Medical",
        "pricing_strategy": PricingStrategy.FIXED_TIERED,
        "default_commission_rate": 10.0,
        "product_details": {
            "inpatient_limits": [500000, 1000000, 2000000, 5000000, 10000000],
            "hospitals": "Jubilee Premier Provider Network",
        },
        "pricing_rules": {
            "inpatient_rates": {
                "500000": {"M": 24000, "M+1": 38000, "M+2": 49000, "M+3": 60000},
                "1000000": {"M": 34000, "M+1": 52000, "M+2": 67000, "M+3": 81000},
                "2000000": {"M": 48000, "M+1": 73000, "M+2": 94000, "M+3": 112000},
                "5000000": {"M": 72000, "M+1": 108000, "M+2": 139000, "M+3": 165000},
            }
        },
        "default_benefits_and_limits": "J-Care comprehensive hospitalization with overseas referral limit up to KES 1,000,000.",
        "default_excesses": "Nil within approved provider panel.",
        "default_special_clauses": "Direct carrier policy, no Risk Note required.",
    },
    {
        "insurer_name": "Jubilee General Insurance Ltd.",
        "name": "WIBA / Employers Liability",
        "class_of_insurance": "WIBA / Employers Liability",
        "pricing_strategy": PricingStrategy.PERCENTAGE,
        "default_commission_rate": 20.0,
        "product_details": {"type": "Statutory Work Injury Benefits Act (Cap 236)"},
        "pricing_rules": {
            "clerical_rate": 0.50,
            "artisan_rate": 1.25,
            "hazardous_rate": 2.50,
            "min_premium": 25000,
        },
        "default_benefits_and_limits": "Death: 96 months earnings. Permanent Total Disability: 96 months. Medical expenses: KES 100,000 per employee.",
        "default_excesses": "Nil on statutory liability.",
        "default_special_clauses": "Declaration of actual annual payroll required at policy expiry.",
    },
    # 3. Britam Insurance
    {
        "insurer_name": "Britam General Insurance (Kenya) Ltd.",
        "name": "Motor Private - Comprehensive Elite",
        "class_of_insurance": "Motor Private",
        "pricing_strategy": PricingStrategy.FIXED_TIERED,
        "default_commission_rate": 10.0,
        "product_details": {
            "excesses": {
                "Own Damage": "2.5% minimum KES 15,000",
                "Third Party": "KES 5,000",
            }
        },
        "pricing_rules": {
            "tiers": [
                {"max": 1500000, "rate": 4.75, "min": 55000},
                {"max": 2500000, "rate": 4.0, "min": 70000},
                {"max": 4000000, "rate": 3.5, "min": 95000},
                {"max": None, "rate": 3.25, "min": 0},
            ],
            "high_end_threshold": 3000000,
        },
        "default_benefits_and_limits": "Elite motor protection with complimentary road rescue and courtesy car option.",
        "default_excesses": "Own Damage 2.5% minimum KES 15,000.",
        "default_special_clauses": "Kenya jurisdiction and approved assessor warranty.",
    },
    {
        "insurer_name": "Britam General Insurance (Kenya) Ltd.",
        "name": "Super Homeowner Package",
        "class_of_insurance": "Domestic Package",
        "pricing_strategy": PricingStrategy.PERCENTAGE,
        "default_commission_rate": 20.0,
        "product_details": {"sections": ["Buildings", "Contents", "Valuables"]},
        "pricing_rules": {
            "buildings_rate": 0.12,
            "contents_rate": 0.80,
            "all_risks_rate": 1.60,
            "servant_flat_fee": 1100,
        },
        "default_benefits_and_limits": "Homeowner package covering private dwelling, outbuildings, boundary walls, and domestic contents.",
        "default_excesses": "KES 5,000 on burglary.",
        "default_special_clauses": "Pairs and sets clause applies to jewelry and art collections.",
    },
    {
        "insurer_name": "Britam General Insurance (Kenya) Ltd.",
        "name": "Milele Health Family Plan",
        "class_of_insurance": "Medical",
        "pricing_strategy": PricingStrategy.FIXED_TIERED,
        "default_commission_rate": 10.0,
        "product_details": {"inpatient_limits": [1000000, 2000000, 5000000, 10000000]},
        "pricing_rules": {
            "inpatient_rates": {
                "1000000": {"M": 33000, "M+1": 50000, "M+2": 65000, "M+3": 79000},
                "2000000": {"M": 46000, "M+1": 70000, "M+2": 90000, "M+3": 108000},
                "5000000": {"M": 70000, "M+1": 102000, "M+2": 132000, "M+3": 158000},
            }
        },
        "default_benefits_and_limits": "Britam Milele inpatient cover with guaranteed lifetime renewal.",
        "default_excesses": "Nil within accredited provider network.",
        "default_special_clauses": "Medical policy; no risk note required.",
    },
    # 4. CIC Insurance
    {
        "insurer_name": "CIC General Insurance Ltd.",
        "name": "Motor Private - Prestige Cover",
        "class_of_insurance": "Motor Private",
        "pricing_strategy": PricingStrategy.FIXED_TIERED,
        "default_commission_rate": 10.0,
        "product_details": {
            "excesses": {
                "Own Damage": "2.5% minimum KES 15,000",
                "Third Party": "KES 5,000",
            }
        },
        "pricing_rules": {
            "tiers": [
                {"max": 1500000, "rate": 4.85, "min": 50000},
                {"max": 2500000, "rate": 4.10, "min": 68000},
                {"max": 3500000, "rate": 3.65, "min": 90000},
                {"max": None, "rate": 3.25, "min": 0},
            ],
            "high_end_threshold": 3000000,
        },
        "default_benefits_and_limits": "Prestige Comprehensive motor with windscreen KES 40,000 and radio KES 25,000.",
        "default_excesses": "2.5% of value minimum KES 15,000.",
        "default_special_clauses": "Standard Kenya jurisdiction clause.",
    },
    {
        "insurer_name": "CIC General Insurance Ltd.",
        "name": "Business Combined & Fire",
        "class_of_insurance": "Fire & Perils",
        "pricing_strategy": PricingStrategy.PERCENTAGE,
        "default_commission_rate": 20.0,
        "product_details": {"type": "Commercial Material Damage"},
        "pricing_rules": {
            "buildings_rate": 0.15,
            "machinery_rate": 0.20,
            "stock_rate": 0.25,
            "min_premium": 35000,
        },
        "default_benefits_and_limits": "Fire and allied perils (explosion, earthquake, riot, strike, malicious damage, flood).",
        "default_excesses": "10% of claim minimum KES 20,000 on special perils.",
        "default_special_clauses": "Warranted fire extinguishing appliances maintained in serviceable condition.",
    },
    # 5. APA Insurance
    {
        "insurer_name": "APA Insurance Ltd.",
        "name": "Motor Private - Drive Sure",
        "class_of_insurance": "Motor Private",
        "pricing_strategy": PricingStrategy.FIXED_TIERED,
        "default_commission_rate": 10.0,
        "product_details": {
            "excesses": {
                "Own Damage": "2.5% minimum KES 15,000",
                "Third Party": "KES 5,000",
            }
        },
        "pricing_rules": {
            "tiers": [
                {"max": 1500000, "rate": 5.0, "min": 55000},
                {"max": 2500000, "rate": 4.0, "min": 72000},
                {"max": 4000000, "rate": 3.5, "min": 95000},
                {"max": None, "rate": 3.25, "min": 0},
            ],
            "high_end_threshold": 3000000,
        },
        "default_benefits_and_limits": "Drive Sure protection with medical expenses up to KES 30,000 per occupant.",
        "default_excesses": "2.5% of value minimum KES 15,000.",
        "default_special_clauses": "Kenya jurisdiction warranty.",
    },
    {
        "insurer_name": "APA Insurance Ltd.",
        "name": "Jamii Plus Family Medical",
        "class_of_insurance": "Medical",
        "pricing_strategy": PricingStrategy.FIXED_TIERED,
        "default_commission_rate": 10.0,
        "product_details": {"inpatient_limits": [1000000, 2000000, 5000000]},
        "pricing_rules": {
            "inpatient_rates": {
                "1000000": {"M": 31000, "M+1": 47000, "M+2": 61000, "M+3": 74000},
                "2000000": {"M": 44000, "M+1": 66000, "M+2": 86000, "M+3": 102000},
                "5000000": {"M": 67000, "M+1": 97000, "M+2": 126000, "M+3": 150000},
            }
        },
        "default_benefits_and_limits": "Jamii Plus inpatient care with emergency air evacuation rider.",
        "default_excesses": "Nil in network.",
        "default_special_clauses": "Medical cover; no risk note created.",
    },
    # 6. ICEA LION
    {
        "insurer_name": "ICEA LION General Insurance Ltd.",
        "name": "Motor Private - Executive Cover",
        "class_of_insurance": "Motor Private",
        "pricing_strategy": PricingStrategy.FIXED_TIERED,
        "default_commission_rate": 10.0,
        "product_details": {
            "excesses": {
                "Own Damage": "2.5% minimum KES 20,000",
                "Third Party": "KES 7,500",
            }
        },
        "pricing_rules": {
            "tiers": [
                {"max": 2000000, "rate": 4.5, "min": 70000},
                {"max": 3500000, "rate": 3.75, "min": 90000},
                {"max": 6000000, "rate": 3.25, "min": 120000},
                {"max": None, "rate": 3.0, "min": 0},
            ],
            "high_end_threshold": 3000000,
        },
        "default_benefits_and_limits": "Executive motor cover with KES 100,000 windscreen and KES 50,000 towing limit.",
        "default_excesses": "2.5% of value minimum KES 20,000.",
        "default_special_clauses": "Authorized dealer repair clause for vehicles under 5 years old.",
    },
    # 7. Britam Specialty & Liability
    {
        "insurer_name": "Britam General Insurance (Kenya) Ltd.",
        "name": "Corporate Professional Indemnity",
        "class_of_insurance": "Professional Indemnity",
        "pricing_strategy": PricingStrategy.PERCENTAGE,
        "default_commission_rate": 15.0,
        "product_details": {
            "excesses": {
                "Each and every claim": "10% of claim amount minimum KES 50,000",
            },
            "special_clauses": [
                "Retroactive date: Inception",
                "Territorial limits: East Africa",
            ],
        },
        "pricing_rules": {
            "rate": 0.60,
            "minimum_premium": 45000,
        },
        "default_benefits_and_limits": "Professional indemnity protection against errors, omissions, and negligence in professional duty.",
        "default_excesses": "10% of claim amount minimum KES 50,000.",
        "default_special_clauses": "Claims made basis policy with retroactive date warranty.",
    },
    {
        "insurer_name": "Britam General Insurance (Kenya) Ltd.",
        "name": "Golfers Comprehensive Package",
        "class_of_insurance": "Golfers",
        "pricing_strategy": PricingStrategy.FIXED_TIERED,
        "default_commission_rate": 15.0,
        "product_details": {
            "sections": {
                "equipment": 150000,
                "third_party_liability": 1000000,
                "personal_accident": 500000,
                "hole_in_one": 35000,
            },
            "excesses": {
                "Equipment": "10% of loss minimum KES 2,500",
                "Third Party": "Nil",
            },
        },
        "pricing_rules": {
            "package_fee": 7500,
        },
        "default_benefits_and_limits": "Golfing equipment KES 150,000, Third-Party Liability KES 1,000,000, Personal Accident KES 500,000, Hole-in-One KES 35,000.",
        "default_excesses": "Equipment 10% minimum KES 2,500.",
        "default_special_clauses": "Hole-in-one claims subject to official club captain and secretary certification.",
    },
    # 8. Old Mutual Commercial & Personal Lines
    {
        "insurer_name": "Old Mutual General Insurance Kenya Ltd.",
        "name": "Commercial Public Liability",
        "class_of_insurance": "Public Liability",
        "pricing_strategy": PricingStrategy.PERCENTAGE,
        "default_commission_rate": 15.0,
        "product_details": {
            "excesses": {
                "Third Party Property Damage": "10% minimum KES 20,000",
                "Bodily Injury": "Nil",
            },
        },
        "pricing_rules": {
            "rate": 0.35,
            "minimum_premium": 20000,
        },
        "default_benefits_and_limits": "Comprehensive public liability for commercial premises and ongoing business operations.",
        "default_excesses": "10% of claim minimum KES 20,000 for property damage.",
        "default_special_clauses": "Premises and operations clause with food and beverage extension.",
    },
    {
        "insurer_name": "Old Mutual General Insurance Kenya Ltd.",
        "name": "Individual Personal Accident (PA)",
        "class_of_insurance": "Personal Accident",
        "pricing_strategy": PricingStrategy.FIXED_TIERED,
        "default_commission_rate": 15.0,
        "product_details": {
            "benefits": {
                "accidental_death": 2000000,
                "permanent_total_disability": 2000000,
                "medical_expenses": 200000,
                "funeral_expense": 50000,
            },
        },
        "pricing_rules": {
            "occupational_tiers": {
                "Class 1 - Clerical": 6500,
                "Class 2 - Supervisory": 9500,
                "Class 3 - Manual": 14000,
            },
        },
        "default_benefits_and_limits": "Accidental Death KES 2M, Permanent Disability KES 2M, Medical Expenses KES 200,000, Funeral KES 50,000.",
        "default_excesses": "Medical expenses excess KES 2,000 each and every claim.",
        "default_special_clauses": "24-hour worldwide personal accident cover.",
    },
    # 9. CIC Commercial Lines
    {
        "insurer_name": "CIC General Insurance Ltd.",
        "name": "Commercial Burglary & Theft",
        "class_of_insurance": "Burglary",
        "pricing_strategy": PricingStrategy.PERCENTAGE,
        "default_commission_rate": 15.0,
        "product_details": {
            "excesses": {
                "Each and every claim": "10% of loss minimum KES 10,000",
            },
            "special_clauses": [
                "Forcible and violent entry warranty",
                "Alarm warranty with 24/7 armed response",
            ],
        },
        "pricing_rules": {
            "rate": 0.75,
            "minimum_premium": 10000,
        },
        "default_benefits_and_limits": "Business stock, plant, and office equipment against forcible and violent theft.",
        "default_excesses": "10% of loss minimum KES 10,000.",
        "default_special_clauses": "Warranted premises fitted with approved radio alarm system.",
    },
    # 10. Jubilee Specialty
    {
        "insurer_name": "Jubilee General Insurance Ltd.",
        "name": "Standalone All Risks Protection",
        "class_of_insurance": "All Risks",
        "pricing_strategy": PricingStrategy.PERCENTAGE,
        "default_commission_rate": 15.0,
        "product_details": {
            "excesses": {
                "Each and every loss": "10% of claim minimum KES 5,000",
            },
        },
        "pricing_rules": {
            "rate": 1.75,
            "minimum_premium": 5000,
        },
        "default_benefits_and_limits": "Worldwide all-risks protection for laptops, cameras, phones, and portable surveying tools.",
        "default_excesses": "10% of value minimum KES 5,000.",
        "default_special_clauses": "Worldwide coverage with unattended vehicle exclusion.",
    },
    # 11. Heritage Insurance Company Ltd.
    {
        "insurer_name": "Heritage Insurance Company Ltd.",
        "name": "Heritage Auto Prestige Comprehensive",
        "class_of_insurance": "Motor Private",
        "pricing_strategy": PricingStrategy.FIXED_TIERED,
        "default_commission_rate": 10.0,
        "product_details": {
            "vehicle_details": {
                "registration_number": "<<text>>",
                "make": "<<text>>",
                "year_of_manufacture": "<<number>>",
                "sum_insured": "<<number>>",
            },
            "added_benefits": {
                "pvt": "<<boolean>>",
                "excess_protector": "<<boolean>>",
                "courtesy_car": "<<boolean>>",
            },
            "excesses": {
                "Own Damage": "2.5% of value minimum KES 15,000",
                "Third Party Property": "KES 5,000",
                "Total Theft": "10% of value minimum KES 20,000",
            },
            "special_clauses": [
                "Geographical limits: Kenya, Uganda, Tanzania",
                "Subject to approved tracker installation above KES 3,000,000",
            ],
        },
        "pricing_rules": {
            "tiers": [
                {"max": 2000000, "rate": 4.5, "min": 55000},
                {"max": 4000000, "rate": 3.75, "min": 85000},
                {"max": None, "rate": 3.25, "min": 120000},
            ],
            "high_end_threshold": 3000000,
        },
        "default_benefits_and_limits": "Comprehensive private cover, Windscreen KES 50,000, Radio KES 30,000, Towing KES 35,000.",
        "default_excesses": "Own Damage 2.5% (min KES 15,000). Third Party Property KES 5,000.",
        "default_special_clauses": "Approved tracking device required for vehicles valued above KES 3M.",
    },
    {
        "insurer_name": "Heritage Insurance Company Ltd.",
        "name": "Heritage Commercial Transporter",
        "class_of_insurance": "Motor Commercial",
        "pricing_strategy": PricingStrategy.PERCENTAGE,
        "default_commission_rate": 10.0,
        "product_details": {
            "excesses": {
                "Own Damage": "5.0% of vehicle value minimum KES 30,000",
                "Third Party Property": "KES 10,000",
            },
            "special_clauses": [
                "Carriage of goods warranty",
                "Fitted with certified speed governor",
            ],
        },
        "pricing_rules": {
            "rate": 5.5,
            "minimum_premium": 60000,
        },
        "default_benefits_and_limits": "Commercial goods vehicle comprehensive indemnity, third party liability up to KES 5,000,000.",
        "default_excesses": "Own damage 5% minimum KES 30,000. Third party property KES 10,000.",
        "default_special_clauses": "Certified driver and valid speed governor warranties.",
    },
    {
        "insurer_name": "Heritage Insurance Company Ltd.",
        "name": "Heritage First Domestic Package",
        "class_of_insurance": "Domestic Package",
        "pricing_strategy": PricingStrategy.PERCENTAGE,
        "default_commission_rate": 17.5,
        "product_details": {
            "excesses": {
                "Buildings & Contents": "KES 5,000 each and every loss",
                "All Risks": "10% minimum KES 2,500",
            },
        },
        "pricing_rules": {
            "building_rate": 0.12,
            "contents_rate": 0.75,
            "all_risks_rate": 1.5,
            "minimum_premium": 10000,
        },
        "default_benefits_and_limits": "Private residential dwelling, contents against fire and burglary, domestic servant WIBA.",
        "default_excesses": "KES 5,000 on sections A & B.",
        "default_special_clauses": "First loss basis on contents, average clause applicable on buildings.",
    },
    # 12. GA Insurance Ltd.
    {
        "insurer_name": "GA Insurance Ltd.",
        "name": "GA Motor Extra Comprehensive",
        "class_of_insurance": "Motor Private",
        "pricing_strategy": PricingStrategy.FIXED_TIERED,
        "default_commission_rate": 10.0,
        "product_details": {
            "vehicle_details": {
                "registration_number": "<<text>>",
                "make": "<<text>>",
                "year_of_manufacture": "<<number>>",
                "sum_insured": "<<number>>",
            },
            "added_benefits": {
                "pvt": "<<boolean>>",
                "excess_protector": "<<boolean>>",
            },
            "excesses": {
                "Own Damage": "2.5% of value minimum KES 15,000",
                "Third Party Property": "KES 5,000",
                "Theft": "10% of value minimum KES 20,000",
            },
        },
        "pricing_rules": {
            "tiers": [
                {"max": 1500000, "rate": 4.75, "min": 50000},
                {"max": 3000000, "rate": 4.0, "min": 70000},
                {"max": None, "rate": 3.25, "min": 100000},
            ],
            "high_end_threshold": 3000000,
        },
        "default_benefits_and_limits": "Comprehensive private cover, Windscreen KES 50,000, Towing KES 30,000.",
        "default_excesses": "Own damage 2.5% minimum KES 15,000.",
        "default_special_clauses": "Geographical limits Kenya. Annual valuation warranty.",
    },
    {
        "insurer_name": "GA Insurance Ltd.",
        "name": "GA Corporate WIBA Scheme",
        "class_of_insurance": "WIBA / Employers Liability",
        "pricing_strategy": PricingStrategy.PERCENTAGE,
        "default_commission_rate": 15.0,
        "product_details": {
            "excesses": {
                "Each claim": "Nil",
            },
            "special_clauses": [
                "Work Injury Benefits Act (WIBA 2007) compliance",
                "Subject to annual wage roll declaration and audit",
            ],
        },
        "pricing_rules": {
            "clerical_rate": 0.35,
            "manual_rate": 1.25,
            "minimum_premium": 25000,
        },
        "default_benefits_and_limits": "Statutory WIBA benefits: 8 years earnings for death / permanent total disability, medical expenses KES 100,000.",
        "default_excesses": "Nil statutory.",
        "default_special_clauses": "Wage roll adjustment clause at policy expiry.",
    },
    {
        "insurer_name": "GA Insurance Ltd.",
        "name": "GA Fire & Industrial Perils",
        "class_of_insurance": "Fire & Perils",
        "pricing_strategy": PricingStrategy.PERCENTAGE,
        "default_commission_rate": 17.5,
        "product_details": {
            "excesses": {
                "Fire and Lightning": "Nil",
                "Special Perils / Storm / Flood": "10% of loss minimum KES 25,000",
            },
        },
        "pricing_rules": {
            "rate": 0.20,
            "minimum_premium": 15000,
        },
        "default_benefits_and_limits": "Commercial buildings and warehouse stock against fire, lightning, explosion, and allied special perils.",
        "default_excesses": "Special perils 10% minimum KES 25,000.",
        "default_special_clauses": "Fire extinguishing appliances warranty and pro-rata average clause.",
    },
]


def seed_insurers_and_products(session: Session) -> dict[str, Any]:
    """Idempotently seed the 8 major Kenyan underwriters and their core insurance products."""
    insurers_by_name: dict[str, Insurer] = {}
    products_by_key: dict[str, Product] = {}

    for ins_data in INSURERS_DATA:
        insurer = session.exec(
            select(Insurer).where(Insurer.name == ins_data["name"])
        ).first()
        if not insurer:
            insurer = Insurer(**ins_data)
            session.add(insurer)
            session.commit()
            session.refresh(insurer)
            logger.info(f"Created insurer: {insurer.name}")
        else:
            insurer.email = ins_data["email"]
            insurer.phone = ins_data["phone"]
            session.add(insurer)
            session.commit()
            session.refresh(insurer)
        insurers_by_name[insurer.name] = insurer

    for prod_data in PRODUCTS_DATA:
        insurer_name = prod_data["insurer_name"]
        insurer = insurers_by_name[insurer_name]
        prod_name = prod_data["name"]

        product = session.exec(
            select(Product).where(
                Product.name == prod_name,
                Product.insurer_id == insurer.id,
            )
        ).first()

        if not product:
            product = Product(
                insurer_id=insurer.id,
                name=prod_name,
                class_of_insurance=prod_data["class_of_insurance"],
                pricing_strategy=prod_data["pricing_strategy"],
                default_commission_rate=prod_data["default_commission_rate"],
                product_details=prod_data["product_details"],
                pricing_rules=prod_data["pricing_rules"],
                default_benefits_and_limits=prod_data["default_benefits_and_limits"],
                default_excesses=prod_data["default_excesses"],
                default_special_clauses=prod_data["default_special_clauses"],
            )
            session.add(product)
            session.commit()
            session.refresh(product)
            logger.info(f"Created product: {prod_name} under {insurer_name}")
        else:
            product.class_of_insurance = prod_data["class_of_insurance"]
            product.pricing_strategy = prod_data["pricing_strategy"]
            product.default_commission_rate = prod_data["default_commission_rate"]
            product.product_details = prod_data["product_details"]
            product.pricing_rules = prod_data["pricing_rules"]
            product.default_benefits_and_limits = prod_data[
                "default_benefits_and_limits"
            ]
            product.default_excesses = prod_data["default_excesses"]
            product.default_special_clauses = prod_data["default_special_clauses"]
            session.add(product)
            session.commit()
            session.refresh(product)

        key = f"{insurer_name}::{prod_name}"
        products_by_key[key] = product

    return {
        "insurers": insurers_by_name,
        "products": products_by_key,
    }
