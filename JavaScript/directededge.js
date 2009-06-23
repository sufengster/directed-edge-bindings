Debug = {};
Debug.debug = function(message)
{
	alert(message);
}


/********************************************************************************
 * HTTP code from From the book JavaScript: The Definitive Guide, 5th Edition
 ********************************************************************************/

HTTP = {};

HTTP.factories = [
    function() { return new XMLHttpRequest(); },
    function() { return new ActiveXObject("Msxml2.XMLHTTP"); },
    function() { return new ActiveXObject("Microsoft.XMLHTTP"); }
 ];

HTTP.factory = null;

HTTP.newRequest = function()
{
    if (HTTP.factory != null)
    {
    return HTTP.factory();
    }

    for(var i = 0; i < HTTP.factories.length; i++)
    {
        try
    {
            var factory = HTTP.factories[i];
            var request = factory();
            if(request != null)
        {
                HTTP.factory = factory;
                return request;
            }
        }
        catch(e)
    {
            continue;
        }
    }

    // If we get here, none of the factory candidates succeeded,
    // so throw an exception now and for all future calls.

    HTTP.factory = function()
    {
        throw new Error("XMLHttpRequest not supported");
    }

    HTTP.factory(); // Throw an error
}

HTTP.getXML = function(url, cb, parameter)
{
    var request = HTTP.newRequest();

    request.onreadystatechange = function()
    {
        if(request.readyState == 4 && request.status == 200)
        {
            cb.callback.call(cb.obj, request.responseXML, parameter);
        }
    }

    request.open("GET", url);
    request.send(null);
}

HTTP.postXML = function(url, callback, data)
{
    var request = HTTP.newRequest();

    if(callback != undefined)
	{
    	request.onreadystatechange = function()
    	{
    	    Debug.debug("postXML: state: " + request.readyState + " status: " + request.status);
    	    if(request.readyState == 4 && request.status == 200)
    	    {
   		         callback();
        	}
    	}
	}

    request.open("PUT", url);
    request.setRequestHeader("Content-Type", "text/xml");
    request.send(data);
}

function Resource(base, hasQuestionMark)
{
	this.base = base;
	if (arguments.length > 1)
	{
		this.hasQuestionMark = hasQuestionMark;
	}
	else
	{
		this.hasQuestionMark = false;
	}
}

Resource.prototype.addResource = function(r)
{
	return new Resource(this.base + "/" + r);
}

Resource.prototype.addKeyValuePair = function(k, v)
{
	if(this.hasQuestionMark)
	{
		var rb = new Resource(this.base + "&" + k + "=" + v, true);
		return rb;
	}

	var rb = new Resource(this.base + "?" + k + "=" + v, true);
	return rb;
}

Resource.prototype.url = function()
{
	return this.base;
}

function Database() {
    this.name = "";
    this.password = "";
    this.host = "webservice.directededge.com";
    this.protocol = "http";
    this.resource = "/api/v1/";
    this.base = new Resource();

    this.initialize = function(name, password, host, protocol) {
        this.name = name;
        this.password = password;
        this.host = host;

        this.base = new Resource(protocol + "://" + name + ":" + password + "@" + host + this.resource + name);
    }
}

function Link(source, target)
{
	this.source = source;
	this.target = target;
	this.weight = 0;
	this.type = "";
}

function Item(database, id)
{
    this.id = id;
    this.database = database;
    this.resource = database.base.addResource(id);

    //item data
    this.tags = new Array();
    this.links = new Array();
    this.properties = new Array();

    //handle callbacks for functions waiting for data read
    this.readCBs = new Array();
    this.cached = false;
}

Item.prototype.readHandler = function(text, cb)
{
    Debug.debug("readHandler");

    var rlinks = text.getElementsByTagName("link");
    for(var i=0; i < rlinks.length; i++)
    {
		var l = new Link(this.id, rlinks.item(i).childNodes[0].nodeValue);

		var weight = rlinks.item(i).attributes['weight'];
		var type = rlinks.item(i).attributes['type'];

		if(weight != undefined)
		{
			l.weight = weight;	
		}
		
		if(type != undefined)
		{
			l.type = type;	
		}

		this.links.push(l);
	}

    var rtags = text.getElementsByTagName("tag");
    for(var i=0; i < rtags.length; i++)
    {
		//ignore "" tags
		if(rtags.item(i).childNodes[0] != undefined)
		{
        	this.addTag(rtags.item(i).childNodes[0].nodeValue);
		}
    }

    var rproperties = text.getElementsByTagName("property");
    for(var i=0; i < rproperties.length; i++)
    {
        this.properties[rproperties.item(i).attributes[0].value] = rproperties.item(i).childNodes[0].nodeValue;
    }

    this.cached = true;

    while(this.readCBs.length > 0)
    {
	var cc = this.readCBs.shift();
    	cc.call(this);
    }
}

Item.prototype.relatedHandler = function(text, callback)
{
	var related = new Array();
	var ritems = text.getElementsByTagName("related");

	for(var i=0; i < ritems.length; i++)
	{
		related.push(new Item(this.database, ritems.item(i).childNodes[0].nodeValue));
	}

	callback(related);
}

Item.prototype.recommendedHandler = function(text, callback)
{
	var recommended = new Array();
	var ritems = text.getElementsByTagName("recommended");

	for(var i=0; i < ritems.length; i++)
	{
		recommended.push(new Item(this.database, ritems.item(i).childNodes[0].nodeValue));
	}

	callback(recommended);
}

Item.prototype.recommendedItems = function(qParameters, callback)
{
	this.query(callback, "recommended", this.recommendedHandler, qParameters);
}

Item.prototype.relatedItems = function(qParameters, callback)
{
	this.query(callback, "related", this.relatedHandler, qParameters);
}

Item.prototype.query = function(callback, method, handler, qParameters)
{
	var res = this.resource.addResource(method);

		res = res.addKeyValuePair("excludeLinked", qParameters.excludeLinked)
			.addKeyValuePair("maxResults", qParameters.maxResults)
			.addKeyValuePair("tags", qParameters.tags.join(","));

    HTTP.getXML(res.url(), {obj: this, callback: handler}, callback);
}

Item.prototype.read = function(callback)
{
    this.readCBs.push(callback);

    //don't start another query while another is still on the run
    if(this.readCBs.length > 1)
    {
        return;
    }

    HTTP.getXML(this.resource.url(), {obj: this, callback: this.readHandler}, callback);
}

Item.prototype.reload = function(callback)
{
	delete this.tags;
	delete this.properties;
	delete this.links;
	
	this.tags = new Array();
	this.properties = new Array();
	this.links = new Array();
	
	this.read(callback);
}

Item.prototype.getLinks = function(callback)
{
    Debug.debug("getLinks (cached: " + this.cached + ")");

    if(this.cached)
    {
        callback(this.links);
    }
    else
    {
        this.read(function() { callback(this.links); });
    }
}

Item.prototype.getTags = function(callback)
{
    Debug.debug("getTag (cached: " + this.cached + ")");

    if (this.cached)
    {
        callback(this.tags);
    }
    else
    {
        this.read(function() { callback(this.tags); });
    }
}

Item.prototype.removeTag = function(tag)
{
	for(var i=0; i < this.tags.length; i++)
	{
		if(this.tags[i] == tag)
		{
			this.tags.splice(i, 1);
			return;
		}
	}
}

Item.prototype.addTag = function(tag)
{
	for(var t in this.tags)
	{
		if(t == tag)
		{
			return false;	
		}
	}

	this.tags.push(tag);
	return true;
}

Item.prototype.setProperty = function(key, value)
{
    this.properties[key] = value;
}

/**
 * callback also here?!
 */
Item.prototype.getProperty = function(key)
{
    return this.properties[key];
}

Item.prototype.getProperties = function(callback)
{
    if (this.cached)
    {
        callback(this.properties);
    }
    else
    {
        this.read(function() { callback(this.properties); });
    }
}

Item.prototype.removeProperty = function(property)
{
	if(this.properties[property] != undefined)
	{
		delete this.properties[property];	
	}
}

Item.prototype.save = function(callback)
{
    Debug.debug("save");
    HTTP.postXML(this.resource.url(), callback, this.toXML());
}

Item.prototype.toXML = function()
{
    var xmlstring = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xmlstring += '<directededge version="1.0">\n';
    xmlstring += '<item id="' + this.id + '">\n';

    for(var i=0; i < this.links.length; i++)
    {
        xmlstring += '<link weight="'+this.links[i].weight+'" type="'+this.links[i].type+'">'+this.links[i].target+'</link>\n';
    }
 
    for(var i=0; i < this.tags.length; i++)
    {
        xmlstring += '<tag>'+this.tags[i]+'</tag>\n';
    }

    for(key in this.properties)
    {
        xmlstring += '<property name="' + key + '">' + this.properties[key] + '</property>\n';
    }
 
    xmlstring += '</item>\n</directededge>\n\n';
    return xmlstring;
}

Item.prototype.linkTo = function(target, weight, type)
{
	var link = new Link(this.id, target);
	if(weight != undefined)
	{
		link.weight = weight;	
	}
	
	if(type != undefined)
	{
		link.type = type;	
	}
	
	this.links.push(link);
}

Item.prototype.unlink = function(target, type)
{
	var t = type != undefined ? type : "";
	
	for(var i=0; this.links; i++)
	{
		var it = this.links[i];
		if(it.target == target && it.type == t)
		{
			delete this.links[i];
			return;
		}
	}
}
