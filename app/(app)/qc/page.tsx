import { redirect } from 'next/navigation'

/** /qc has no dashboard of its own — send it to the fabrication surface. */
export default function QcIndexPage() {
  redirect('/qc/fabrication')
}
