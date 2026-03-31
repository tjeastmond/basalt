#!/bin/sh
set -eu

readonly_user="${POSTGRES_READONLY_USER:-basalt_readonly}"
readonly_pass="${POSTGRES_READONLY_PASSWORD:-basalt_readonly}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
CREATE USER ${readonly_user} WITH PASSWORD '${readonly_pass}';
GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO ${readonly_user};
GRANT USAGE ON SCHEMA public TO ${readonly_user};
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${readonly_user};
ALTER DEFAULT PRIVILEGES FOR ROLE ${POSTGRES_USER} IN SCHEMA public
  GRANT SELECT ON TABLES TO ${readonly_user};
SQL
