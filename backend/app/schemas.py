import uuid
import json
import pydantic
from decimal import Decimal
from typing import Annotated, Any, Literal

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


class FinancialBreakdown(BaseModel):
    product_class: str
    breakdown: Annotated[
        MotorFinancialBreakdown | BaseFinancialBreakdown,
        Field(discriminator="type"),
    ]


class QuoteRequest(BaseModel):
    product_id: uuid.UUID
    risk_details: dict[str, Any]


class QuoteResponse(BaseModel):
    breakdown: MotorFinancialBreakdown | BaseFinancialBreakdown


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
    model_config = ConfigDict(
        populate_by_name=True,
        extra="ignore"
    )

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
            if isinstance(val, (list, dict)):
                data[term_key] = json.dumps(val, indent=2)
            elif val is None:
                data[term_key] = ""
                
        return data
