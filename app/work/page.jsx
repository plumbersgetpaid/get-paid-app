                <a
                  href={`/jobs/view/${job.id}`}
                  style={hasImportantNoteByJob[job.id] ? importantNoteLinkStyle : jobLinkStyle}
                >
                  {hasImportantNoteByJob[job.id] ? "⚠️ " : ""}View job
                  {noteCountByJob[job.id] ? ` · ${noteCountByJob[job.id]} note${noteCountByJob[job.id] === 1 ? "" : "s"}` : ""}
                </a>
