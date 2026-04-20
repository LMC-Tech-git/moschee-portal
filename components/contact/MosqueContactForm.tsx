"use client";

import { useTranslations } from "next-intl";
import { MOSQUE_INQUIRY_TYPES } from "@/lib/contact/inquiryTypes";
import { BaseContactForm } from "./BaseContactForm";

interface MosqueContactFormProps {
  apiPath: string;
  mosqueName?: string;
}

export function MosqueContactForm({ apiPath, mosqueName }: MosqueContactFormProps) {
  const t = useTranslations("contact.mosque");

  const inquiryTypes = MOSQUE_INQUIRY_TYPES.map((value) => ({
    value,
    label: t(`inquiryTypes.${value}`),
  }));

  return (
    <BaseContactForm
      config={{
        inquiryTypes,
        showOrganization: false,
        apiPath,
        defaultInquiryType: "general",
      }}
      mosqueName={mosqueName}
    />
  );
}
