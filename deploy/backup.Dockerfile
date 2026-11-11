# Backup runner: the MySQL client tools plus age for encryption.
FROM golang:1.23-bookworm AS age
RUN CGO_ENABLED=0 go install filippo.io/age/cmd/age@v1.2.1 filippo.io/age/cmd/age-keygen@v1.2.1

FROM mysql:8.4
RUN microdnf install -y tar gzip findutils && microdnf clean all
COPY --from=age /go/bin/age /go/bin/age-keygen /usr/local/bin/
COPY backup.sh restore.sh backup-loop.sh /backup/
RUN chmod +x /backup/*.sh
ENTRYPOINT ["/bin/bash", "/backup/backup-loop.sh"]
