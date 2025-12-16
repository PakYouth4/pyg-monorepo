FROM node:20

# Install system dependencies AS ROOT (before switching to node user)
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg python3 && \
    rm -rf /var/lib/apt/lists/*

# Install yt-dlp binary directly (as root)
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

# Now switch to non-root user
USER node
ENV HOME=/home/node PATH=/home/node/.local/bin:$PATH
WORKDIR $HOME/app

# Install npm deps
COPY --chown=node package*.json $HOME/app/
RUN npm install

# Copy source and build
COPY --chown=node . $HOME/app
RUN npm run build

EXPOSE 7860
CMD ["node", "dist/server.js"]