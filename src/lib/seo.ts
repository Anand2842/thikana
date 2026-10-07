import "server-only";
import type { Broker, Listing } from "./mock-data";

const BASE =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const absoluteUrl = (path: string) =>
  path.startsWith("http") ? path : `${BASE}${path.startsWith("/") ? "" : "/"}${path}`;

const firstPhoto = (photos: string[]): string | null => {
  const p = photos.find(
    (u) => typeof u === "string" && u.startsWith("https://"),
  );
  return p ?? null;
};

// Unique, human-readable title per listing: BHK + type + locality + city +
// rent. Rents differ per broker, so same-home listings never share a title.
// The layout title template appends "| Thikana".
export function listingTitle(l: Listing): string {
  return `${l.bhk} BHK ${l.type} for Rent in ${l.locality}, ${l.city} · ₹${l.rent.toLocaleString("en-IN")}/mo`;
}

export function listingDescription(l: Listing, brokerName: string): string {
  const bits = [
    `${l.bhk} BHK ${l.type}, ${l.area} sq.ft, ${l.furnishing}`,
    `₹${l.rent.toLocaleString("en-IN")}/mo + ${l.brokDays} days brokerage`,
    l.visitFee === 0 ? "no visit fee" : `₹${l.visitFee} visit fee`,
    `verified broker ${brokerName}`,
  ];
  return `${bits.join(" · ")}. Available ${l.avail}.`.slice(0, 160);
}

const org = {
  "@type": "Organization",
  "@id": absoluteUrl("/#org"),
  name: "Thikana",
  url: BASE,
};

// Apartment + Offer: the unit eligible for Google rich results. Broker
// appears as a rated RealEstateAgent (E-E-A-T: real identity, real reviews,
// human verification) and Thikana as publisher.
export function listingJsonLd(
  l: Listing,
  broker: { id: string; agency: string; rating: number; reviews: number } | null,
  brokerReviewCount: number,
) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Apartment",
        "@id": absoluteUrl(`/properties/${l.id}#home`),
        name: `${l.bhk} BHK ${l.type} in ${l.locality}, ${l.city}`,
        description: l.desc,
        url: absoluteUrl(`/properties/${l.id}`),
        address: {
          "@type": "PostalAddress",
          addressLocality: l.locality,
          addressRegion: l.city,
          addressCountry: "IN",
        },
        floorSize: { "@type": "QuantitativeValue", value: l.area, unitCode: "FTK" },
        numberOfRooms: l.bhk,
        ...(l.createdAt
          ? { datePosted: new Date(l.createdAt).toISOString().slice(0, 10) }
          : {}),
        ...(l.photos.length && firstPhoto(l.photos)
          ? { image: l.photos.filter((p) => p.startsWith("https://")) }
          : {}),
        offers: {
          "@type": "Offer",
          price: l.rent,
          priceCurrency: "INR",
          availability:
            l.availabilityStatus === "Taken" || l.availabilityStatus === "OnHold"
              ? "https://schema.org/OutOfStock"
              : "https://schema.org/InStock",
          ...(broker
            ? {
                seller: {
                  "@type": "RealEstateAgent",
                  "@id": absoluteUrl(`/brokers/${broker.id}#agent`),
                  name: broker.agency,
                  url: absoluteUrl(`/brokers/${broker.id}`),
                  aggregateRating: {
                    "@type": "AggregateRating",
                    ratingValue: broker.rating,
                    reviewCount: Math.max(brokerReviewCount, broker.reviews),
                  },
                },
              }
            : {}),
        },
        publisher: { "@id": absoluteUrl("/#org") },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Properties", item: absoluteUrl("/properties") },
          { "@type": "ListItem", position: 2, name: l.city, item: absoluteUrl(`/properties?city=${encodeURIComponent(l.city)}`) },
          { "@type": "ListItem", position: 3, name: `${l.bhk} BHK in ${l.locality}`, item: absoluteUrl(`/properties/${l.id}`) },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: `What is the brokerage for this ${l.locality} home?`,
            acceptedAnswer: {
              "@type": "Answer",
              text: `${l.brokDays} days of rent (₹${Math.round((l.rent * l.brokDays) / 30).toLocaleString("en-IN")}), disclosed before any visit.`,
            },
          },
          {
            "@type": "Question",
            name: "Is there a visit fee, and is it refundable?",
            acceptedAnswer: {
              "@type": "Answer",
              text:
                l.visitFee === 0
                  ? "No visit fee."
                  : `₹${l.visitFee} visit fee, ${l.visitFeeRefundable ? "refundable" : "non-refundable — pay only after verifying the property in person"}.`,
            },
          },
        ],
      },
      org,
    ],
  };
}

export function brokerJsonLd(b: Broker, activeCount: number) {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "@id": absoluteUrl(`/brokers/${b.id}#agent`),
    name: b.agency,
    url: absoluteUrl(`/brokers/${b.id}`),
    areaServed: b.cities,
    ...(b.photo?.startsWith("https://") ? { image: b.photo } : {}),
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: b.rating,
      reviewCount: b.reviews,
    },
    ...(activeCount
      ? {
          makesOffer: {
            "@type": "Offer",
            itemOffered: {
              "@type": "ItemList",
              numberOfItems: activeCount,
            },
          },
        }
      : {}),
  };
}

export function brokerTitle(b: Broker): string {
  return `${b.agency} — Verified Broker in ${b.cities.join(", ")}`;
}

export function brokerDescription(b: Broker, activeCount: number): string {
  return `${b.agency}: ★${b.rating} (${b.reviews} reviews), ${b.responseTime} response, ${b.tenure}. ${activeCount} active verified home${activeCount === 1 ? "" : "s"}. ${b.policy}`.slice(0, 160);
}
