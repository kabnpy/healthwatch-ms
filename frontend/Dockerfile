# Stage 0, "build-stage", based on Node.js, to build and compile the frontend
FROM node:24 AS build-stage

WORKDIR /app

COPY package*.json /app/

RUN npm install

COPY ./ /app/

ARG VITE_API_URL=${VITE_API_URL}

RUN npm run build


# Stage 1, based on Nginx, to have only the compiled app, ready for production with Nginx
FROM nginx:1

COPY --from=build-stage /app/dist/ /usr/share/nginx/html

COPY ./nginx.conf /etc/nginx/conf.d/default.conf
COPY ./nginx-backend-not-found.conf /etc/nginx/extra-conf.d/backend-not-found.conf

# Use a shell command to replace default port 80 if Railway-assigned $PORT is set
CMD ["sh", "-c", "if [ -n \"$PORT\" ]; then sed -i 's/listen 80;/listen '\"$PORT\"';/g' /etc/nginx/conf.d/default.conf; fi && exec nginx -g 'daemon off;'"]
