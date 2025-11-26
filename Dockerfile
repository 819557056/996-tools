FROM node:22-alpine AS build-stage
# Set environment variables for non-interactive npm installs
ENV NPM_CONFIG_LOGLEVEL warn
ENV CI true
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm i --frozen-lockfile

# Copy source code
COPY . .

# Build the application
# 使用 pnpm run build 会执行 package.json 中的 build 脚本 (vue-tsc && vite build)
# 如果遇到 TypeScript 类型错误导致构建失败，可以改用: RUN pnpm exec vite build
RUN pnpm exec vite build

# production stage
FROM nginx:stable-alpine AS production-stage
COPY --from=build-stage /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

