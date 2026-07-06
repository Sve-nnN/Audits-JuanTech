import { CONSENT_TEXT } from "@auditor/email";
import { VerifyClient } from "./VerifyClient";
import styles from "../home.module.css";

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function VerifyPage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Confirmá tu email</h1>
        <VerifyClient token={token ?? null} consentText={CONSENT_TEXT} />
      </div>
    </main>
  );
}
