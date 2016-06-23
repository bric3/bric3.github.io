# Getting started
https://pages.github.com/

# More
* https://help.github.com/articles/configuring-jekyll/
* http://jekyllrb.com/docs/github-pages/


Nokogiri installed with :


```sh
sudo gem install nokogiri -v '1.6.8' --                                \
     --use-system-libraries=true                                       \
     --with-xml2-include=/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX10.11.sdk/usr/include/libxml2
```

Answer source http://stackoverflow.com/a/35113383/48136


# Styling the pre tag
http://mediatemple.net/blog/tips/considerations-for-styling-the-pre-tag/

# Liquid templates with functions, filters, tags
http://jekyllrb.com/docs/templates/
https://github.com/Shopify/liquid/wiki/Liquid-for-Designers#tags
https://github.com/Shopify/liquid/wiki/Liquid-for-Designers#standard-filters


# GH Blog setup

See http://www.adamwadeharris.com/how-to-convert-a-wordpress-site-to-jekyll-with-github-pages/

Best guide (but deprecated on some aspects) : http://blog.8thcolor.com/en/2014/05/migrate-from-wordpress/

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
- [ ] DNS
- [ ] Move some file to `_pages`
