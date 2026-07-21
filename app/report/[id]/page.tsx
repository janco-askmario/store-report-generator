"use client";

import { useParams } from "next/navigation";
import { ReportEditor } from "@/components/ReportEditor";

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  return <ReportEditor id={id} />;
}
