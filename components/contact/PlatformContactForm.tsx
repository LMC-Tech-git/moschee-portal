"use client";

import { useTranslations } from "next-intl";
import { PLATFORM_INQUIRY_TYPES } from "@/lib/contact/inquiryTypes";
import { BaseContactForm } from "./BaseContactForm";

interface PlatformContactFormProps {
  apiPath?: string;
}

export function PlatformContactForm({ apiPath = "/api/contact" }: PlatformContactFormProps) {
  const t = useTranslations("contact.platform");

  const inquiryTypes = PLATFORM_INQUIRY_TYPES.map((value) => ({
    value,
    label: t(`inquiryTypes.${value}`),
  }));

  return (
    <BaseContactForm
      config={{
        inquiryTypes,
        showOrganization: true,
        apiPath,
      }}
    />
  );
}
