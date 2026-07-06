import { CONSENT_TEXT } from "@auditor/email";
import { VerifyClient } from "./VerifyClient";
import styles from "./verify.module.css";

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function VerifyPage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  return (
    <div className={styles.page}>
      <h1 className={styles.srTitle}>Verificación de correo</h1>
      <div className={styles.panel}>
        <VerifyClient token={token ?? null} consentText={CONSENT_TEXT} />
      </div>
    </div>
  );
}
