import { Document, Page, renderToBuffer, StyleSheet, Text, View } from '@react-pdf/renderer';

export interface CertificateData {
  holderName: string;
  pathTitle: string;
  finalScore: number;
  issuedAt: string;
  folio: string;
  verifyUrl: string;
}

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  frame: { flex: 1, marginBottom: 22, border: '3pt solid #1e3a8a', padding: 36, justifyContent: 'center', alignItems: 'center' },
  brand: { fontSize: 14, color: '#1e3a8a', letterSpacing: 4, marginBottom: 24 },
  title: { fontSize: 32, color: '#111827', marginBottom: 28, fontFamily: 'Helvetica-Bold' },
  lead: { fontSize: 13, color: '#4b5563', marginBottom: 10 },
  name: { fontSize: 28, color: '#1e3a8a', marginBottom: 14, fontFamily: 'Helvetica-Bold', textAlign: 'center' },
  path: { fontSize: 20, color: '#111827', marginBottom: 20, textAlign: 'center', fontFamily: 'Helvetica-Bold' },
  meta: { fontSize: 12, color: '#374151', marginBottom: 4 },
  footer: { position: 'absolute', bottom: 22, left: 0, right: 0, alignItems: 'center' },
  folio: { fontSize: 11, color: '#111827', fontFamily: 'Helvetica-Bold' },
  verify: { fontSize: 9, color: '#6b7280', marginTop: 3 },
});

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Mexico_City' });


export async function renderCertificate(d: CertificateData): Promise<Buffer> {
  return renderToBuffer(
    <Document title={`Constancia ${d.folio}`} author="LexCode">
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.frame}>
          <Text style={styles.brand}>LEXCODE</Text>
          <Text style={styles.title}>Constancia de finalización</Text>
          <Text style={styles.lead}>Se otorga a</Text>
          <Text style={styles.name}>{d.holderName}</Text>
          <Text style={styles.lead}>por completar la ruta de aprendizaje</Text>
          <Text style={styles.path}>{d.pathTitle}</Text>
          <Text style={styles.meta}>Calificación final: {d.finalScore.toFixed(1)} / 100</Text>
          <Text style={styles.meta}>Fecha de emisión: {formatDate(d.issuedAt)}</Text>
        </View>
        <View style={styles.footer}>
          <Text style={styles.folio}>Folio {d.folio}</Text>
          <Text style={styles.verify}>Verifica su autenticidad en {d.verifyUrl}</Text>
        </View>
      </Page>
    </Document>,
  );
}
