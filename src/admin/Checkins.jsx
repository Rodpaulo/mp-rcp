import { buildCsv, downloadCsv } from './csv.js'
import { yesNo } from './text.js'

export default function Checkins({ edition, presences }) {
  function handleExport() {
    const rows = presences.map((p) => [p.email, p.time, p.source, yesNo(p.registered), yesNo(p.newsletter)])
    const csv = buildCsv(['email', 'hora', 'origem', 'inscrito', 'newsletter'], rows)
    downloadCsv(`${edition.code}-presencas.csv`, csv)
  }

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <h2>Presenças ({presences.length})</h2>
        <button type="button" className="admin-button-secondary" onClick={handleExport}>
          Exportar CSV
        </button>
      </div>
      {presences.length === 0 ? (
        <p className="admin-muted">Ainda não há presenças.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Hora</th>
                <th>Origem</th>
                <th>Inscrito</th>
              </tr>
            </thead>
            <tbody>
              {presences.map((p) => (
                <tr key={p.personId}>
                  <td>{p.email}</td>
                  <td>{p.time}</td>
                  <td>{p.source}</td>
                  <td>{yesNo(p.registered)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
