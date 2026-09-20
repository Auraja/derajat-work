"use client";
import { useParams } from "next/navigation";
import { Breadcrumb, PageHeader } from "@/components/ui";
import { SessionForm } from "@/components/session-form";
export default function NewSessionPage(){const {slug}=useParams<{slug:string}>();return <><Breadcrumb items={[{label:"Teaching",href:`/workspaces/${slug}/teaching`},{label:"Sessions",href:`/workspaces/${slug}/teaching/sessions`},{label:"New"}]}/><PageHeader title="Sesi baru" description="Mulai dengan konteks pembelajaran yang jelas. Detail dapat disempurnakan nanti."/><SessionForm/></>}
