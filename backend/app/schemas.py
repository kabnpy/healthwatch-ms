import json
import uuid
from decimal import Decimal
from typing import Annotated, Any, Literal

import pydantic
from pydantic import BaseModel, ConfigDict, Field, field_validator


class BenefitLineItem(BaseModel):
    name: str
    amount: Decimal


class BaseFinancialBreakdown(BaseModel):
    type: Literal["base"] = "base"
    net_premium: Decimal
    taxes: dict[str, Decimal] = Field(default_factory=dict)
    commission_amount: Decimal
    total_amount: Decimal


class MotorFinancialBreakdown(BaseFinancialBreakdown):
    type: Literal["motor"] = "motor"
    benefits: list[BenefitLineItem] = Field(default_factory=list)
    basic_rate: Decimal | None = None
    is_high_end: bool = False


class DomesticFinancialBreakdown(BaseFinancialBreakdown):
    type: Literal["domestic"] = "domestic"
    section_premiums: dict[str, Decimal] = Field(default_factory=dict)
    buildings_sum_insured: Decimal = Field(default=Decimal("0.00"))
    contents_sum_insured: Decimal = Field(default=Decimal("0.00"))
    all_risks_valuables: Decimal = Field(default=Decimal("0.00"))


class WIBAFinancialBreakdown(BaseFinancialBreakdown):
    type: Literal["wiba"] = "wiba"
    payroll_totals: dict[str, Decimal] = Field(default_factory=dict)
    employee_count: int = 1


class CommercialFireFinancialBreakdown(BaseFinancialBreakdown):
    type: Literal["fire"] = "fire"
    total_sum_insured: Decimal = Field(default=Decimal("0.00"))
    special_perils_included: bool = True


class MarineFinancialBreakdown(BaseFinancialBreakdown):
    type: Literal["marine"] = "marine"
    cif_value: Decimal = Field(default=Decimal("0.00"))
    uplifted_value: Decimal = Field(default=Decimal("0.00"))
    clause: str = "Clause A"


class MedicalFinancialBreakdown(BaseFinancialBreakdown):
    type: Literal["medical"] = "medical"
    inpatient_limit: Decimal = Field(default=Decimal("0.00"))
    inpatient_premium: Decimal = Field(default=Decimal("0.00"))
    outpatient_premium: Decimal = Field(default=Decimal("0.00"))
    family_size: int = 1


BreakdownUnion = (
    MotorFinancialBreakdown
    | DomesticFinancialBreakdown
    | WIBAFinancialBreakdown
    | CommercialFireFinancialBreakdown
    | MarineFinancialBreakdown
    | MedicalFinancialBreakdown
    | BaseFinancialBreakdown
)


class FinancialBreakdown(BaseModel):
    product_class: str
    breakdown: Annotated[
        BreakdownUnion,
        Field(discriminator="type"),
    ]


class QuoteRequest(BaseModel):
    product_id: uuid.UUID
    risk_details: dict[str, Any]


class QuoteResponse(BaseModel):
    breakdown: BreakdownUnion


class MotorVehicleDetails(BaseModel):
    registration_number: str = Field(..., min_length=1)
    make: str = Field(..., min_length=1)
    year_of_manufacture: int | None = None
    sum_insured: Decimal = Field(default=Decimal("0"))

    @field_validator("sum_insured", mode="before")
    @classmethod
    def parse_sum_insured(cls, v: Any) -> Decimal:
        from app.utils import parse_decimal

        return parse_decimal(v)


class MotorExtensions(BaseModel):
    pvt: bool = False
    excess_protector: bool = False
    om_rescue_plus: bool = False
    passenger_liability: bool = False


class MotorPrivateRiskDetails(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    vehicle: MotorVehicleDetails
    extensions: MotorExtensions = Field(default_factory=MotorExtensions)
    # Terms as plain text/markdown
    benefits_and_limits: str = ""
    excesses: str = ""
    special_clauses: str = ""

    @pydantic.model_validator(mode="before")
    @classmethod
    def wrap_legacy_and_flat_fields(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data

        # 1. Handle legacy sub-object names
        if "vehicle_details" in data and "vehicle" not in data:
            data["vehicle"] = data.pop("vehicle_details")
        if "added_benefits" in data and "extensions" not in data:
            data["extensions"] = data.pop("added_benefits")

        # 2. Extract potential sub-objects
        vehicle = data.get("vehicle", {})
        if not isinstance(vehicle, dict):
            vehicle = {}

        extensions = data.get("extensions", {})
        if not isinstance(extensions, dict):
            extensions = {}

        # 3. Define key mappings
        vehicle_mapping = {
            "Reg. No": "registration_number",
            "registration_number": "registration_number",
            "Make": "make",
            "make": "make",
            "Year": "year_of_manufacture",
            "year_of_manufacture": "year_of_manufacture",
            "Value Kshs.": "sum_insured",
            "sum_insured": "sum_insured",
        }

        extension_mapping = {
            "pvt": "pvt",
            "excess_protector": "excess_protector",
            "om_rescue_plus": "om_rescue_plus",
            "passenger_liability": "passenger_liability",
        }

        # 4. Pull keys from top-level data AND nested objects into clean normalized structures
        final_vehicle = {}
        final_extensions = {}

        # Helper to get the best value among candidates
        def get_best_val(*candidates: Any) -> Any:
            for c in candidates:
                if c is not None and c != "[ EMPTY ]" and c != "":
                    return c
            return None

        # Check top-level first, then nested
        for legacy_key, semantic_key in vehicle_mapping.items():
            top_val = data.get(legacy_key)
            nested_val = vehicle.get(legacy_key)

            best = get_best_val(top_val, nested_val)
            if best is not None:
                final_vehicle[semantic_key] = best
                # Cleanup top-level if we found it there
                if legacy_key in data:
                    data.pop(legacy_key)

        for legacy_key, semantic_key in extension_mapping.items():
            top_val = data.get(legacy_key)
            nested_val = extensions.get(legacy_key)

            best = get_best_val(top_val, nested_val)
            if best is not None:
                final_extensions[semantic_key] = best
                # Cleanup top-level if we found it there
                if legacy_key in data:
                    data.pop(legacy_key)

        # 5. Handle 'terms' nesting if it exists
        if "terms" in data and isinstance(data["terms"], dict):
            terms = data.pop("terms")
            for k, v in terms.items():
                if k not in data:
                    data[k] = v

        # 6. Final assignment
        data["vehicle"] = final_vehicle
        data["extensions"] = final_extensions

        # 7. Handle terms that might be list/dict in legacy data
        for term_key in ["benefits_and_limits", "excesses", "special_clauses"]:
            val = data.get(term_key)
            if isinstance(val, list | dict):
                data[term_key] = json.dumps(val, indent=2)
            elif val is None:
                data[term_key] = ""

        return data


class DomesticPackageRiskDetails(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    buildings_sum_insured: Decimal = Field(default=Decimal("0.00"))
    contents_sum_insured: Decimal = Field(default=Decimal("0.00"))
    all_risks_valuables: Decimal = Field(default=Decimal("0.00"))
    domestic_servants_indoor: int = Field(default=0)
    domestic_servants_outdoor: int = Field(default=0)
    owners_liability_limit: Decimal = Field(default=Decimal("0.00"))

    @field_validator(
        "buildings_sum_insured",
        "contents_sum_insured",
        "all_risks_valuables",
        "owners_liability_limit",
        mode="before",
    )
    @classmethod
    def parse_money(cls, v: Any) -> Decimal:
        from app.utils import parse_decimal

        return parse_decimal(v)


class WIBARiskDetails(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    clerical_payroll: Decimal = Field(default=Decimal("0.00"))
    artisan_payroll: Decimal = Field(default=Decimal("0.00"))
    hazardous_payroll: Decimal = Field(default=Decimal("0.00"))
    employee_count: int = Field(default=1)

    @field_validator(
        "clerical_payroll", "artisan_payroll", "hazardous_payroll", mode="before"
    )
    @classmethod
    def parse_payroll(cls, v: Any) -> Decimal:
        from app.utils import parse_decimal

        return parse_decimal(v)


class FirePerilsRiskDetails(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    buildings_sum_insured: Decimal = Field(default=Decimal("0.00"))
    plant_machinery_sum_insured: Decimal = Field(default=Decimal("0.00"))
    stock_sum_insured: Decimal = Field(default=Decimal("0.00"))
    include_special_perils: bool = Field(default=True)

    @field_validator(
        "buildings_sum_insured",
        "plant_machinery_sum_insured",
        "stock_sum_insured",
        mode="before",
    )
    @classmethod
    def parse_fire_si(cls, v: Any) -> Decimal:
        from app.utils import parse_decimal

        return parse_decimal(v)


class MarineCargoRiskDetails(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    cif_value: Decimal = Field(default=Decimal("0.00"))
    origin_port: str = Field(default="")
    destination_port: str = Field(default="Mombasa")
    clause: str = Field(default="Clause A")

    @field_validator("cif_value", mode="before")
    @classmethod
    def parse_cif(cls, v: Any) -> Decimal:
        from app.utils import parse_decimal

        return parse_decimal(v)


class MedicalRiskDetails(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    inpatient_limit: Decimal = Field(default=Decimal("1000000.00"))
    principal_age: int = Field(default=30)
    has_spouse: bool = Field(default=False)
    spouse_age: int | None = Field(default=None)
    children_count: int = Field(default=0)
    include_outpatient: bool = Field(default=False)
    outpatient_limit: Decimal = Field(default=Decimal("50000.00"))

    @field_validator("inpatient_limit", "outpatient_limit", mode="before")
    @classmethod
    def parse_med_limits(cls, v: Any) -> Decimal:
        from app.utils import parse_decimal

        return parse_decimal(v)


class SystemInfo(BaseModel):
    app_name: str = "HealthWatch MS"
    environment: str
    currency: str = "KES"
    timezone: str = "UTC"
    version: str = "0.1.0"
    status: str = "operational"
