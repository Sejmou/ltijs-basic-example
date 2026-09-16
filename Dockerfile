FROM ghcr.io/pnpm/pnpm:11 AS base
RUN pnpm runtime set node 24 -g
COPY . /app
WORKDIR /app

FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM base AS typecheck
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run typecheck

FROM base
COPY --from=prod-deps /app/node_modules /app/node_modules
# Node runs src/*.ts directly (type stripping), so there's no dist to copy.
# Referencing the typecheck stage makes BuildKit run it and fail the build on type errors.
COPY --from=typecheck /app/package.json /tmp/typechecked
EXPOSE 3000
CMD [ "pnpm", "start" ]
