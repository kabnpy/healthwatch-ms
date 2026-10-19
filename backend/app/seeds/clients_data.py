"""
Clients Reference Data Seed.
Realistic Kenyan Individual and Corporate client profiles spanning multiple sectors and regions.
"""

import logging
from typing import Any

from sqlmodel import Session, select

from app.models import Client

logger = logging.getLogger(__name__)

CLIENTS_DATA: list[dict[str, Any]] = [
    # ==========================================
    # 1. Retail Individuals & Professionals
    # ==========================================
    {
        "client_type": "Individual",
        "name": "Agnes Njoki Mwangi",
        "kra_pin": "A001158997L",
        "phone": "+254 733 980566",
        "email": "agnes.mwangi@example.com",
        "physical_address": "House 14, Riverside Drive",
        "postal_number": "11908",
        "postal_code": "00100",
        "town": "Nairobi",
        "contacts": [],
    },
    {
        "client_type": "Individual",
        "name": "Dr. David Kiprop Kiptoo",
        "kra_pin": "A002849120K",
        "phone": "+254 722 450192",
        "email": "dr.kiptoo@example.com",
        "physical_address": "Nairobi Hospital Doctors Plaza, 3rd Floor",
        "postal_number": "30120",
        "postal_code": "00100",
        "town": "Nairobi",
        "contacts": [],
    },
    {
        "client_type": "Individual",
        "name": "Grace Wanjiku Kariuki",
        "kra_pin": "A003928174M",
        "phone": "+254 720 889123",
        "email": "gwkariuki.advocate@example.com",
        "physical_address": "Delta Corner Annex, Westlands",
        "postal_number": "54210",
        "postal_code": "00200",
        "town": "Nairobi",
        "contacts": [],
    },
    {
        "client_type": "Individual",
        "name": "Brian Otieno Onyango",
        "kra_pin": "A004819231P",
        "phone": "+254 711 349081",
        "email": "brian.onyango@example.com",
        "physical_address": "Wood Avenue Court, Kilimani",
        "postal_number": "41029",
        "postal_code": "00100",
        "town": "Nairobi",
        "contacts": [],
    },
    {
        "client_type": "Individual",
        "name": "Dr. Amina Fatuma Hassan",
        "kra_pin": "A005928104T",
        "phone": "+254 734 509214",
        "email": "amina.hassan@example.com",
        "physical_address": "Aga Khan University Hospital, Doctors Suites",
        "postal_number": "30270",
        "postal_code": "00623",
        "town": "Nairobi",
        "contacts": [],
    },
    {
        "client_type": "Individual",
        "name": "Kevin Mutua Musyoka",
        "kra_pin": "A006192847B",
        "phone": "+254 723 910283",
        "email": "k.musyoka.arch@example.com",
        "physical_address": "James Gichuru Road, Lavington",
        "postal_number": "22910",
        "postal_code": "00100",
        "town": "Nairobi",
        "contacts": [],
    },
    {
        "client_type": "Individual",
        "name": "Faith Chebet Koech",
        "kra_pin": "A007382910D",
        "phone": "+254 701 445920",
        "email": "faith.koech@example.com",
        "physical_address": "General Mathenge Drive, Westlands",
        "postal_number": "66400",
        "postal_code": "00800",
        "town": "Nairobi",
        "contacts": [],
    },
    {
        "client_type": "Individual",
        "name": "Samuel Ndung'u Githinji",
        "kra_pin": "A008192384G",
        "phone": "+254 722 603912",
        "email": "sam.githinji@example.com",
        "physical_address": "Mimosa Ridge, Runda Estate",
        "postal_number": "78100",
        "postal_code": "00100",
        "town": "Nairobi",
        "contacts": [],
    },
    {
        "client_type": "Individual",
        "name": "Sarah Akinyi Ochieng",
        "kra_pin": "A009482710Q",
        "phone": "+254 721 890451",
        "email": "sarah.ochieng@example.com",
        "physical_address": "Mandera Road, Kileleshwa",
        "postal_number": "14500",
        "postal_code": "00100",
        "town": "Nairobi",
        "contacts": [],
    },
    {
        "client_type": "Individual",
        "name": "Peter Kiprono Cheruiyot",
        "kra_pin": "A010392841E",
        "phone": "+254 724 391082",
        "email": "peter.cheruiyot@example.com",
        "physical_address": "Elgon View Estate, Plot 42",
        "postal_number": "1200",
        "postal_code": "30100",
        "town": "Eldoret",
        "contacts": [],
    },
    {
        "client_type": "Individual",
        "name": "Mary Mwende Muthama",
        "kra_pin": "A011928471Z",
        "phone": "+254 726 550192",
        "email": "mary.muthama@example.com",
        "physical_address": "Muhoho Avenue, South C",
        "postal_number": "19400",
        "postal_code": "00100",
        "town": "Nairobi",
        "contacts": [],
    },
    {
        "client_type": "Individual",
        "name": "John Gitau Karanja",
        "kra_pin": "A012849102X",
        "phone": "+254 722 901845",
        "email": "jg.karanja@example.com",
        "physical_address": "Windy Ridge, Karen",
        "postal_number": "24900",
        "postal_code": "00502",
        "town": "Nairobi",
        "contacts": [],
    },
    {
        "client_type": "Individual",
        "name": "Fatuma Omar Swaleh",
        "kra_pin": "A013491028R",
        "phone": "+254 712 340918",
        "email": "fatuma.swaleh@example.com",
        "physical_address": "Links Road, Nyali",
        "postal_number": "85200",
        "postal_code": "80100",
        "town": "Mombasa",
        "contacts": [],
    },
    {
        "client_type": "Individual",
        "name": "Daniel Kibet Korir",
        "kra_pin": "A014920184K",
        "phone": "+254 720 192837",
        "email": "daniel.korir@example.com",
        "physical_address": "Section 58, Nakuru",
        "postal_number": "3400",
        "postal_code": "20100",
        "town": "Nakuru",
        "contacts": [],
    },
    {
        "client_type": "Individual",
        "name": "Esther Wangui Njoroge",
        "kra_pin": "A015829103C",
        "phone": "+254 722 710928",
        "email": "esther.njoroge@example.com",
        "physical_address": "Ridgeways Lane, Kiambu Road",
        "postal_number": "43900",
        "postal_code": "00100",
        "town": "Nairobi",
        "contacts": [],
    },
    # ==========================================
    # 2. High-Net-Worth Households
    # ==========================================
    {
        "client_type": "Individual",
        "name": "Ambassador Michael K. Mutiso",
        "kra_pin": "A016892014Y",
        "phone": "+254 722 510920",
        "email": "amb.mutiso@example.com",
        "physical_address": "Miotoni West Road, Karen",
        "postal_number": "24100",
        "postal_code": "00502",
        "town": "Nairobi",
        "contacts": [
            {"name": "Eunice Mutiso", "role": "Spouse", "phone": "+254 722 510921"}
        ],
    },
    {
        "client_type": "Individual",
        "name": "Hon. Catherine Wangari Ndegwa",
        "kra_pin": "A017920184W",
        "phone": "+254 722 849102",
        "email": "c.ndegwa@example.com",
        "physical_address": "Ruaka Road, Runda Estate",
        "postal_number": "72400",
        "postal_code": "00100",
        "town": "Nairobi",
        "contacts": [
            {
                "name": "James Ndegwa",
                "role": "Family Trustee",
                "phone": "+254 722 849103",
            }
        ],
    },
    {
        "client_type": "Individual",
        "name": "Ramesh Harilal Shah",
        "kra_pin": "A018491029U",
        "phone": "+254 733 601928",
        "email": "rhshah@example.com",
        "physical_address": "Limuru Road, Muthaiga",
        "postal_number": "48900",
        "postal_code": "00623",
        "town": "Nairobi",
        "contacts": [],
    },
    {
        "client_type": "Individual",
        "name": "Engineer Patrick Omondi Alila",
        "kra_pin": "A019284910S",
        "phone": "+254 721 902847",
        "email": "eng.alila@example.com",
        "physical_address": "Beach Road, Nyali",
        "postal_number": "90200",
        "postal_code": "80100",
        "town": "Mombasa",
        "contacts": [],
    },
    # ==========================================
    # 3. Commercial Fleets & Corporate SMEs
    # ==========================================
    {
        "client_type": "Corporate",
        "name": "Rift Valley Hauliers Ltd.",
        "kra_pin": "P051289412M",
        "phone": "+254 51 2214900",
        "email": "logistics@rvhauliers.co.ke",
        "physical_address": "Industrial Area, Nakuru-Eldoret Highway",
        "postal_number": "4120",
        "postal_code": "20100",
        "town": "Nakuru",
        "contacts": [
            {
                "name": "Joseph Kiprop",
                "role": "Managing Director",
                "phone": "+254 722 890123",
            },
            {
                "name": "Lydia Chelagat",
                "role": "Fleet Manager",
                "phone": "+254 721 901234",
            },
        ],
    },
    {
        "client_type": "Corporate",
        "name": "Apex Legal Chambers LLP",
        "kra_pin": "P052891024K",
        "phone": "+254 20 2718900",
        "email": "admin@apexlegal.co.ke",
        "physical_address": "Upper Hill Chambers, 8th Floor, 2nd Ngong Avenue",
        "postal_number": "30450",
        "postal_code": "00100",
        "town": "Nairobi",
        "contacts": [
            {
                "name": "Senior Partner George Ochieng",
                "role": "Managing Partner",
                "phone": "+254 722 304918",
            },
            {
                "name": "Alice Wanjiru",
                "role": "Finance Director",
                "phone": "+254 722 304919",
            },
        ],
    },
    {
        "client_type": "Corporate",
        "name": "Blue Nile Trading & Distribution Ltd.",
        "kra_pin": "P053491028L",
        "phone": "+254 20 6532400",
        "email": "accounts@blueniledistributors.co.ke",
        "physical_address": "Commercial Street, Industrial Area",
        "postal_number": "18200",
        "postal_code": "00500",
        "town": "Nairobi",
        "contacts": [
            {"name": "Mustafa Alibhai", "role": "Director", "phone": "+254 733 490182"},
            {
                "name": "Peter Ndegwa",
                "role": "Warehouse & Fleet Head",
                "phone": "+254 720 490182",
            },
        ],
    },
    {
        "client_type": "Corporate",
        "name": "Savanna Safari Tours & Travel Ltd.",
        "kra_pin": "P054819203N",
        "phone": "+254 20 4449800",
        "email": "operations@savannasafaris.co.ke",
        "physical_address": "Ring Road Parklands, Westlands",
        "postal_number": "64100",
        "postal_code": "00620",
        "town": "Nairobi",
        "contacts": [
            {
                "name": "Duncan Murage",
                "role": "Managing Director",
                "phone": "+254 722 102938",
            },
            {
                "name": "Grace Nyambura",
                "role": "Transport Manager",
                "phone": "+254 721 102938",
            },
        ],
    },
    {
        "client_type": "Corporate",
        "name": "Highlands Horticulture Enterprises Ltd.",
        "kra_pin": "P055928104T",
        "phone": "+254 50 2021900",
        "email": "info@highlandshorticulture.co.ke",
        "physical_address": "Moi South Lake Road, Naivasha",
        "postal_number": "1290",
        "postal_code": "20117",
        "town": "Naivasha",
        "contacts": [
            {
                "name": "Hendrik Van Der Merwe",
                "role": "Operations Director",
                "phone": "+254 722 748192",
            },
            {
                "name": "Beatrice Kamau",
                "role": "HR & Admin Manager",
                "phone": "+254 720 748192",
            },
        ],
    },
    {
        "client_type": "Corporate",
        "name": "Nairobi Techworks Solutions Ltd.",
        "kra_pin": "P056192847P",
        "phone": "+254 20 3871900",
        "email": "finance@techworks.co.ke",
        "physical_address": "The Mirage, Chiromo Road, Westlands",
        "postal_number": "28100",
        "postal_code": "00100",
        "town": "Nairobi",
        "contacts": [
            {"name": "Ken Mwangi", "role": "CEO", "phone": "+254 710 491028"},
            {
                "name": "Angela Mutheu",
                "role": "Head of People",
                "phone": "+254 711 491028",
            },
        ],
    },
    {
        "client_type": "Corporate",
        "name": "Coastal Logistics & Marine Services Ltd.",
        "kra_pin": "P057382910R",
        "phone": "+254 41 2314800",
        "email": "dispatch@coastallogistics.co.ke",
        "physical_address": "Mbaraki Wharf, Port Reitz Road",
        "postal_number": "90400",
        "postal_code": "80100",
        "town": "Mombasa",
        "contacts": [
            {
                "name": "Captain Salim Juma",
                "role": "General Manager",
                "phone": "+254 722 981240",
            },
        ],
    },
    {
        "client_type": "Corporate",
        "name": "Peak Engineering & Construction Ltd.",
        "kra_pin": "P058192384V",
        "phone": "+254 20 2341900",
        "email": "contracts@peakengineering.co.ke",
        "physical_address": "Enterprise Road, Industrial Area",
        "postal_number": "49100",
        "postal_code": "00500",
        "town": "Nairobi",
        "contacts": [
            {
                "name": "Eng. Kenneth Kilonzo",
                "role": "Managing Director",
                "phone": "+254 722 410293",
            },
        ],
    },
    {
        "client_type": "Corporate",
        "name": "Lake Basin Medical Center Ltd.",
        "kra_pin": "P059482710W",
        "phone": "+254 57 2024900",
        "email": "administration@lakebasinmedical.co.ke",
        "physical_address": "Milimani Estate, Kisumu",
        "postal_number": "2100",
        "postal_code": "40100",
        "town": "Kisumu",
        "contacts": [
            {
                "name": "Dr. Florence Adhiambo",
                "role": "Medical Superintendent",
                "phone": "+254 722 610294",
            },
        ],
    },
]


def seed_clients(session: Session) -> dict[str, Client]:
    """Idempotently seed individual and corporate client directory."""
    clients_by_kra: dict[str, Client] = {}

    for c_data in CLIENTS_DATA:
        kra_pin = c_data["kra_pin"]
        client = session.exec(select(Client).where(Client.kra_pin == kra_pin)).first()

        if not client:
            client = Client(**c_data)
            session.add(client)
            session.commit()
            session.refresh(client)
            logger.info(f"Created client: {client.name} ({kra_pin})")
        else:
            client.name = c_data["name"]
            client.phone = c_data["phone"]
            client.email = c_data["email"]
            client.physical_address = c_data["physical_address"]
            client.postal_number = c_data["postal_number"]
            client.postal_code = c_data["postal_code"]
            client.town = c_data["town"]
            client.contacts = c_data["contacts"]
            client.client_type = c_data["client_type"]
            session.add(client)
            session.commit()
            session.refresh(client)

        clients_by_kra[kra_pin] = client

    return clients_by_kra
