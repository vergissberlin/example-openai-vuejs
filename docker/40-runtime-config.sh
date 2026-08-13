#!/bin/sh
# Renders the two things that depend on where this container is deployed.
#
# The nginx image runs every /docker-entrypoint.d/*.sh before starting the
# server, so this happens once per container start.
#
#   API_BASE_URL -> /config.js, read by src/config.ts
#   PUBLIC_URL   -> the Open Graph tags in index.html
#
# The Open Graph tags cannot go through /config.js: crawlers do not run the
# page's JavaScript, so those urls have to be in the served HTML.
#
# Output goes to a directory of its own rather than into the document root,
# which stays read-only and owned by root — nginx serves both files from here
# via exact-match locations. See nginx.conf.
set -eu

# Overridable so the tests can run this without a container. In the image
# these are always the defaults; nothing sets them.
SOURCE_DIR=${SOURCE_DIR:-/opt/app-template}
OUTPUT_DIR=${OUTPUT_DIR:-/opt/app-runtime}

# Refuse anything that is not a plain http(s) url. API_BASE_URL is written into
# a JavaScript string literal and PUBLIC_URL into an HTML attribute, so a quote
# or a backslash would break out of its context. Validating beats escaping
# here: there is no legitimate url that this rejects.
require_url() {
	name=$1
	value=$2

	if [ -z "$value" ]; then
		echo "$0: $name is required. Set it on the container, e.g." >&2
		echo "  $name=https://api.example.com" >&2
		exit 1
	fi

	case "$value" in
	http://* | https://*) ;;
	*)
		echo "$0: $name must start with http:// or https://, got '$value'." >&2
		exit 1
		;;
	esac

	if [ -n "$(printf '%s' "$value" | tr -d 'A-Za-z0-9._~:/?#@!$&()*+,;=%-')" ]; then
		echo "$0: $name contains characters that are not allowed in a url." >&2
		exit 1
	fi
}

# Trailing slashes are stripped so callers may write the url either way.
strip_trailing_slash() {
	printf '%s' "$1" | sed 's|/*$||'
}

require_url API_BASE_URL "${API_BASE_URL-}"
require_url PUBLIC_URL "${PUBLIC_URL-}"

api_base_url=$(strip_trailing_slash "$API_BASE_URL")
public_url=$(strip_trailing_slash "$PUBLIC_URL")

mkdir -p "$OUTPUT_DIR"

# Exactly one field, written explicitly. Never loop over the environment: that
# turns any variable someone happens to set into something the browser can
# read, which is how a secret ends up in a public bundle.
cat >"$OUTPUT_DIR/config.js" <<EOF
window.__APP_CONFIG__ = { apiBaseUrl: "$api_base_url" }
EOF

# The image is built with VITE_PUBLIC_URL=runtime, which tells the vite plugin
# to leave the placeholder in place for this script. If it is missing, the
# image was built some other way and this script would silently serve whatever
# url was compiled in — fail instead, where the deploy log will show it.
if ! grep -q '%PUBLIC_URL%' "$SOURCE_DIR/index.html"; then
	echo "$0: no %PUBLIC_URL% placeholder in index.html." >&2
	echo "$0: build the image with VITE_PUBLIC_URL=runtime." >&2
	exit 1
fi

sed "s|%PUBLIC_URL%|$public_url|g" "$SOURCE_DIR/index.html" >"$OUTPUT_DIR/index.html"

echo "$0: serving $public_url, backend $api_base_url"
