/** Structured data describes only the public business details and visible page content. */
const plain = value => String(value ?? '').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
const fullUrl = (domain,slug='') => `${domain}/${slug.replace(/^\/+/, '')}`;

export function structuredData({site,domain,slug,title,description,content,socialImage,schema,seo,canonical}) {
  const pageUrl=canonical || fullUrl(domain,slug);
  const agencyId=`${domain}/#avec-jo`, personId=`${domain}/#joseph`, websiteId=`${domain}/#website`, pageId=`${pageUrl}#webpage`;
  const graph=[
    {'@type':'TravelAgency','@id':agencyId,name:site.name,url:fullUrl(domain),logo:fullUrl(domain,site.logo),image:fullUrl(domain,site.hero),description:seo.businessDescription,telephone:site.phone,email:site.email,address:{'@type':'PostalAddress',streetAddress:'25 Nguyen Van Loc',addressLocality:'Ha Dong, Hanoi',addressCountry:'VN'},sameAs:Object.values(site.social),areaServed:seo.areas.map(name=>({'@type':'Place',name})),contactPoint:{'@type':'ContactPoint',telephone:site.phone,email:site.email,contactType:'customer service',availableLanguage:['fr']}},
    {'@type':'Person','@id':personId,name:'Joseph',jobTitle:'Guide francophone au Vietnam',knowsLanguage:['fr'],worksFor:{'@id':agencyId}},
    {'@type':'WebSite','@id':websiteId,url:fullUrl(domain),name:site.name,inLanguage:'fr',publisher:{'@id':agencyId}},
    {'@type':slug==='contact'?'ContactPage':slug==='blog'||slug==='services'||slug==='circuits'||slug.startsWith('tag/')?'CollectionPage':'WebPage','@id':pageId,url:pageUrl,name:title,description,inLanguage:'fr',isPartOf:{'@id':websiteId},about:{'@id':agencyId},primaryImageOfPage:{'@type':'ImageObject',url:socialImage}}
  ];
  const breadcrumbHtml=content.match(/<nav class="breadcrumbs"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
  if(breadcrumbHtml){
    const items=[...breadcrumbHtml.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m,i)=>{
      const href=m[1].match(/href="([^"]+)"/)?.[1];
      return {'@type':'ListItem',position:i+1,name:plain(m[1]),item:href?new URL(href.replace(/&amp;/g,'&'),fullUrl(domain,slug+'/')).href:pageUrl};
    });
    if(items.length>1){graph.push({'@type':'BreadcrumbList','@id':`${pageUrl}#breadcrumb`,itemListElement:items});graph[3].breadcrumb={'@id':`${pageUrl}#breadcrumb`};}
  }
  if(schema?.['@type']==='BlogPosting'){
    const article={...schema,'@id':`${pageUrl}#article`,author:{'@id':agencyId},publisher:{'@id':agencyId},mainEntityOfPage:{'@id':pageId}};
    delete article['@context'];graph.push(article);graph[3].mainEntity={'@id':article['@id']};
  } else if(schema?.['@type']==='Service') {
    const service={...schema,'@id':`${pageUrl}#service`,url:pageUrl,provider:{'@id':agencyId}};
    delete service['@context'];graph.push(service);graph[3].mainEntity={'@id':service['@id']};
  } else if(schema?.['@type']==='ItemList') {
    const list={...schema,'@id':`${pageUrl}#circuits`,itemListElement:schema.itemListElement.map(item=>({...item,url:fullUrl(domain,item.url)}))};
    graph.push(list);graph[3].mainEntity={'@id':list['@id']};
  }
  return {'@context':'https://schema.org','@graph':graph};
}
