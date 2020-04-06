# Getting started
https://pages.github.com/

**OUTDATED FOR NOW**

This will be updated at a later time.

## Run locally

### With docker

```sh
docker run --name blog --tty --rm --volume "$PWD":/usr/src/app:delegated --volume site:/usr/src/app/_site --publish "4000:4000" starefossen/github-pages
```

Eventually remove the old `Gemfile.lock`

### By installing stuffs locally
#### More
* https://help.github.com/articles/configuring-jekyll/
* http://jekyllrb.com/docs/github-pages/

Nokogiri installed with :

```sh
sudo gem install nokogiri -v '1.7.1' --                                \
     --use-system-libraries=true                                       \
     --with-xml2-include=/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX10.12.sdk/usr/include/libxml2
```

Answer source http://stackoverflow.com/a/35113383/48136

And then

```sh
bundle exec jekyll serve -w --port 4000
```

## Jekyll styling

### Styling the pre tag
http://mediatemple.net/blog/tips/considerations-for-styling-the-pre-tag/

### Liquid templates with functions, filters, tags
http://jekyllrb.com/docs/templates/
https://github.com/Shopify/liquid/wiki/Liquid-for-Designers#tags
https://github.com/Shopify/liquid/wiki/Liquid-for-Designers#standard-filters
http://hamishwillee.github.io/2014/06/11/public-drafts-in-jekyll/


# blog.arkey.fr GH Blog setup

See
* https://adam.garrett-harris.com/how-to-convert-a-wordpress-site-to-jekyll-with-github-pages
* http://haacked.com/archive/2013/12/09/preserving-disqus-comments-with-jekyll/
* Best guide (but deprecated on some aspects) : http://blog.8thcolor.com/en/2014/05/migrate-from-wordpress/
* https://help.disqus.com/customer/en/portal/articles/2158629

- [x] Wordpress Export (All content)

    https://blog.arkey.fr/wp-admin/export.php

- [x] Run the jekyll import tool

    ```bash
    gem install jekyll-import
    gem install hpricot
    ```

    Then run

    ```bash
    ruby -rubygems -e 'require "jekyll-import"; JekyllImport::Importers::WordpressDotCom.run({ "source" => "wordpress.xml" })'
    ```

- [x] Migrate posts to full markdown (tables, lists, blockquotes, pre code, ...)
- [x] Tweak theme (Carte noire)
- [x] Migrate some pages to md
- [x] HTTPS
- [x] Translate remaining english sentences
- [ ] Use liquid filter escape, to avoid escaping in the data file
- [x] Migrate comments to Disqus
    * Create disqus account, install disqus plugin on wordpress,
    * Get the `disqus_identifier` for each posts, updates each pages with corresponding identifier
    * Configure Disqus with `disqus_identifier = {{page.disqus_identifier}}`
    * Configure Disqus with `page.url ={{ site.cname }}{{ page.url }}`
- [x] DNS
    https://www.lewagon.com/blog/siteweb-domaine-mail-personalise
- [x] Move some file to `_pages`
- [x] Fix SSL for custom CNAME once GH handles it (using cloudflare now)
    See :
    * http://blog.webjeda.com/jekyll-ssl/
    * https://konklone.com/post/github-pages-now-sorta-supports-https-so-use-it
    * https://sheharyar.me/blog/free-ssl-for-github-pages-with-custom-domains/
