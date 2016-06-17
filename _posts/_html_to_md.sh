#!/bin/bash

post=$1

echo mardownize $post


perl -pi -e 's/author:/author: Brice Dutheil/g' $post

perl -pi -e 's/<img.*title="(.*?)".*src="(.*?)".*>/![\1](\2)/g' $post

sed -i.bak -E $'s/<p>(.*)<\\/p>/\\1\\\n/g' $post
sed -i.bak -E $'s/<h1>(.*)<\\/h1>/# \\1\\\n/g' $post
sed -i.bak -E $'s/<h2>(.*)<\\/h2>/## \\1\\\n/g' $post
sed -i.bak -E $'s/<h3>(.*)<\\/h3>/### \\1\\\n/g' $post

perl -pi -e 's/&lt;/</g' $post
perl -pi -e 's/&gt;/>/g' $post
perl -pi -e 's/&amp;/&/g' $post
perl -pi -e 's/&quot;/"/g' $post

perl -pi -e 's/<br \/>/\n/g' $post

perl -pi -e 's/<strong>(.*?)<\/strong>/**\1**/g' $post
perl -pi -e 's/<em>(.*?)<\/em>/*\1*/g' $post

perl -pi -e 's/<a.*href="(.*)".*>(.*)<\/a>/[\2](\1)/g' $post

perl -pi -e 's/<pre.*lang:(\w+).*>(.*)<\/pre>/```\1\n\2\n```\n/g' $post
perl -pi -e 's/<pre.*lang:(\w+).*>(.*)/```\1\n\2/g' $post
perl -pi -e 's/(.*?)<\/pre>/\1\n```\n/g' $post

mv ${post} ${post%.*}.md
