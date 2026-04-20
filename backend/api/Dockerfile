FROM golang:1.25.9-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/api ./cmd/api && \
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/migrate ./cmd/migrate

FROM alpine:3.21 AS runtime
WORKDIR /app
RUN adduser -D -u 10001 app
COPY --from=build /out/api /app/bin/api
COPY --from=build /out/migrate /app/bin/migrate
USER app
EXPOSE 3001
ENTRYPOINT ["/app/bin/api"]
