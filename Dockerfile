# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .

FROM node:20-alpine
WORKDIR /app

# 1. Dependencias del sistema (incluyendo libnsl moderno + gcompat para glibc)
RUN apk add --no-cache \
    libaio \
    libnsl \
    libc6-compat \
    gcompat \
    curl \
    unzip

# 2. Descarga e instalación Instant Client Basic 19.19 (URL oficial)
RUN curl -o instantclient.zip \
    -L https://download.oracle.com/otn_software/linux/instantclient/1919000/instantclient-basic-linux.x64-19.19.0.0.0dbru.zip \
    -H "Cookie: oraclelicense=accept" && \
    unzip instantclient.zip && \
    mv instantclient_19_19 /usr/lib/instantclient && \
    rm instantclient.zip

# 3. Enlaces simbólicos para compatibilidad Alpine
RUN ln -s /usr/lib/instantclient/libclntsh.so.19.1 /usr/lib/libclntsh.so && \
    ln -s /usr/lib/instantclient/libocci.so.19.1 /usr/lib/libocci.so && \
    ln -s /usr/lib/libnsl.so.3 /usr/lib/libnsl.so.1 && \ 
    ldconfig /usr/lib/instantclient  

# 4. Variables de entorno obligatorias
ENV LD_LIBRARY_PATH=/usr/lib/instantclient

COPY --from=builder /app ./

# PM2 global
RUN npm install pm2 -g

EXPOSE 5304

# pm2-runtime es el modo especial para Docker (mantiene señales SIGINT/SIGTERM)
CMD ["pm2-runtime", "ecosystem.config.cjs","--env", "production"]