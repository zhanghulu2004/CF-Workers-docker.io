const DOCKER_REGISTRY = 'https://registry-1.docker.io'
const PROXY_REGISTRY = 'https://docker.mirror.zhanghulu.cn'
const HTML = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="shortcut icon" href="https://voxsay.com/assets/img/favicons/favicon.ico">
    <title>镜像代理使用说明</title>
    <style>
        body {
            font-family: 'Roboto', sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
        }
        .header {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: #fff;
            padding: 20px 0;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .container {
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            background-color: #fff;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            border-radius: 10px;
        }
        .content {
            margin-bottom: 20px;
        }
        .footer {
            text-align: center;
            padding: 20px 0;
            background-color: #333;
            color: #fff;
        }
        pre {
            background-color: #272822;
            color: #f8f8f2;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
        }
        code {
            font-family: 'Source Code Pro', monospace;
        }
        a {
            font-weight: bold;
            color: #ffffff;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
        @media (max-width: 600px) {
            .container {
                margin: 20px;
                padding: 15px;
            }
            .header {
                padding: 15px 0;
            }
        }
    </style>
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&family=Source+Code+Pro:wght@400;700&display=swap" rel="stylesheet">
</head>
<body>
    <div class="header">
        <h1>Docker 镜像代理使用说明</h1>
    </div>
    <div class="container">
        <div class="content">
          <p>拉取镜像</p>
          <pre><code># 拉取 redis 镜像（不带命名空间）
docker pull {:host}/redis

# 拉取 rabbitmq 镜像
docker pull {:host}/library/rabbitmq

# 拉取 postgresql 镜像
docker pull {:host}/bitnami/postgresql</code></pre><p>重命名镜像</p>
          <pre><code># 重命名 redis 镜像
docker tag {:host}/library/redis redis 

# 重命名 postgresql 镜像
docker tag {:host}/bitnami/postgresql bitnami/postgresql</code></pre><p>添加镜像源</p>
          <pre><code># 添加镜像代理到 Docker 镜像源
sudo tee /etc/docker/daemon.json &lt;&lt; EOF
{
  "registry-mirrors": ["https://{:host}"]
}
EOF</code></pre>
        </div>
    </div>
    <div class="footer">
        <p>©2024 <a href="https://voxsay.com">voxsay.com</a>. All rights reserved. Powered by <a href="https://cloudflare.com">Cloudflare</a>.</p>
    </div>
</body>
</html>
`
addEventListener('fetch', (event) => {
    event.passThroughOnException()
    event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
    const url = new URL(request.url)
    const path = url.pathname
    if (path === '/v2/') {
        return challenge(DOCKER_REGISTRY, url.host)
    } else if (path === '/auth/token') {
        return getToken(url)
    } else if (url.pathname === '/') {
        return home(url.host);
    }

    const parts = path.split('/')
    if (parts.length === 5) {
        parts.splice(2, 0, 'library')
        const newUrl = new URL(PROXY_REGISTRY)
        newUrl.pathname = parts.join('/')
        return Response.redirect(newUrl.toString(), 301)
    }

    return getData(DOCKER_REGISTRY, request)
}

async function challenge(upstream, host) {
    const url = new URL(upstream + '/v2/')
    const response = await fetch(url)
    const responseBody = await response.text()
    const headers = new Headers()
    headers.set('WWW-Authenticate', `Bearer realm="https://${host}/auth/token",service="docker-proxy-worker"`)
    return new Response(responseBody, { 
        status: response.status,
        statusText: response.statusText,
        headers
    })
}

async function getToken(originUrl) {
    let scope = processScope(originUrl)
    const url = new URL('https://auth.docker.io/token')
    url.searchParams.set('service', 'registry.docker.io')
    url.searchParams.set('scope', scope)
    const response = await fetch(url)
    return response
}

async function getData(upstream, req) {
    const originUrl = new URL(req.url)
    const url = new URL(upstream + originUrl.pathname)
    const request = new Request(url, {
        method: req.method,
        headers: req.headers,
        redirect: 'follow'
    })

    const response = await fetch(request)
    return response
}

function processScope(url) {
    let scope = url.searchParams.get('scope')
    let parts = scope.split(':')
    if (parts.length === 3 && !parts[1].includes('/')) {
        parts[1] = 'library/' + parts[1]
        scope = parts.join(':')
    }
    return scope
}

function home(host) {
    return new Response(HTML.replace(/{:host}/g, host), {
        status: 200,
        headers: {
            "Content-Type": "text/html",
        }
    })
}
