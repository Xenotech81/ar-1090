# https://blog.anvileight.com/posts/simple-python-http-server/#python-3-x-1
# openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365

from http.server import HTTPServer, SimpleHTTPRequestHandler
import ssl


PORT = 4444

httpd = HTTPServer(('0.0.0.0', PORT), SimpleHTTPRequestHandler)

httpd.socket = ssl.wrap_socket(httpd.socket,
                               keyfile="key_unencrypted.pem",
                               certfile='cert.pem', server_side=True)

print("Http Server Serving at port", PORT)
httpd.serve_forever()
