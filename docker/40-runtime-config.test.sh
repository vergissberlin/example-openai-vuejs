#!/bin/sh
# Tests for 40-runtime-config.sh.
#
# This script decides what every deployed container serves, and two of its
# failure modes are silent: a wrong backend url, or an Open Graph placeholder
# left unsubstituted. Run with `sh docker/40-runtime-config.test.sh`.
set -eu

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
UNDER_TEST="$SCRIPT_DIR/40-runtime-config.sh"

failures=0
workspace=$(mktemp -d)
trap 'rm -rf "$workspace"' EXIT

pass() { printf 'ok   %s\n' "$1"; }
fail() {
	printf 'FAIL %s\n     %s\n' "$1" "$2"
	failures=$((failures + 1))
}

# Values are passed as arguments rather than as a `VAR=x helper` prefix: for a
# shell *function* those assignments may outlive the call, which would leak
# state from one case into the next.
#
# Usage: run <api-base-url> <public-url>. The literal string `-` means unset,
# which is a different case from an empty value.
run() {
	rm -rf "$workspace/html" "$workspace/out"
	mkdir -p "$workspace/html" "$workspace/out"
	printf '%s\n' '<meta property="og:url" content="%PUBLIC_URL%/" />' \
		>"$workspace/html/index.html"

	run_against_source "$@"
}

# Same, but keeps whatever index.html the caller already put in place.
run_against_source() {
	(
		[ "$1" = '-' ] || export API_BASE_URL="$1"
		[ "$2" = '-' ] || export PUBLIC_URL="$2"
		export SOURCE_DIR="$workspace/html" OUTPUT_DIR="$workspace/out"
		sh "$UNDER_TEST"
	) >"$workspace/stdout" 2>"$workspace/stderr"
}

expect_ok() {
	description=$1
	shift
	if run "$@"; then
		pass "$description"
	else
		fail "$description" "refused it — $(cat "$workspace/stderr")"
	fi
}

expect_rejected() {
	description=$1
	shift
	if run "$@"; then
		fail "$description" 'accepted the value instead of refusing it'
	else
		pass "$description"
	fi
}

expect_file_contains() {
	description=$1
	file=$2
	needle=$3
	if grep -qF "$needle" "$workspace/out/$file"; then
		pass "$description"
	else
		fail "$description" "$file holds: $(cat "$workspace/out/$file")"
	fi
}

expect_file_lacks() {
	description=$1
	file=$2
	needle=$3
	if grep -qF "$needle" "$workspace/out/$file"; then
		fail "$description" "$file holds: $(cat "$workspace/out/$file")"
	else
		pass "$description"
	fi
}

# --- the happy path -------------------------------------------------------

expect_ok 'accepts two plain urls' https://api.example.com https://chat.example.com
expect_file_contains 'writes the backend url into config.js' \
	config.js 'apiBaseUrl: "https://api.example.com"'
expect_file_contains 'substitutes the Open Graph placeholder' \
	index.html 'content="https://chat.example.com/"'
expect_file_lacks 'leaves no placeholder behind' index.html '%PUBLIC_URL%'

# Only the one field. A loop over the environment would put anything that
# happens to be set into the browser bundle.
OPENAI_API_KEY=must-not-appear
export OPENAI_API_KEY
run https://api.example.com https://chat.example.com
expect_file_lacks 'writes only the configured field' config.js 'must-not-appear'
unset OPENAI_API_KEY

# --- trailing slashes -----------------------------------------------------

run 'https://api.example.com///' 'https://chat.example.com/'
expect_file_contains 'strips trailing slashes from the backend url' \
	config.js 'apiBaseUrl: "https://api.example.com"'
expect_file_contains 'strips trailing slashes from the public url' \
	index.html 'content="https://chat.example.com/"'

# --- refusals -------------------------------------------------------------

expect_rejected 'refuses a missing API_BASE_URL' - https://chat.example.com
expect_rejected 'refuses a missing PUBLIC_URL' https://api.example.com -
expect_rejected 'refuses an empty API_BASE_URL' '' https://chat.example.com
expect_rejected 'refuses a url without a scheme' api.example.com https://chat.example.com

# The value lands inside a JavaScript string literal.
expect_rejected 'refuses a quote that would break out of the string literal' \
	'https://a.example.com";window.x="' https://chat.example.com
expect_rejected 'refuses a backslash' \
	'https://a.example.com\' https://chat.example.com

# And this one lands in an HTML attribute.
expect_rejected 'refuses markup in PUBLIC_URL' \
	https://api.example.com 'https://c.example.com"><script>x()</script>'

# --- a wrongly built image ------------------------------------------------

rm -rf "$workspace/html" "$workspace/out"
mkdir -p "$workspace/html" "$workspace/out"
printf '%s\n' '<meta property="og:url" content="https://baked-in.example.com/" />' \
	>"$workspace/html/index.html"
if run_against_source https://api.example.com https://chat.example.com; then
	fail 'refuses an image built without VITE_PUBLIC_URL=runtime' \
		'served the baked-in url instead of refusing'
else
	pass 'refuses an image built without VITE_PUBLIC_URL=runtime'
fi

# --------------------------------------------------------------------------

echo
if [ "$failures" -eq 0 ]; then
	echo 'all assertions passed'
else
	echo "$failures assertion(s) failed"
	exit 1
fi
