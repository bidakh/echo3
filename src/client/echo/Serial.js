/**
 * Tools for serializing components, stylesheets, and property instances to and from XML.
 * @namespace
 */
EchoSerial = { 

    /**
     * Map between property class names and property translators.
     * Property translators stored in this map will be used when an object
     * provides a "className" property.
     */
    _propertyTranslatorMap: { },
    
    /**
     * Array describing mapping between object constructors and property translators.
     * Even indices of the map contain constructors, and the subsequent odd indices
     * contain the property translator suitable for the constructor at the previous
     * index.  This array is iterated to determine the appropriate property translator.
     * This array is only used for a very small number of non-primitive 
     * property types which are provided by JavaScript itself, e.g., Date.
     */
    _propertyTranslatorTypeData: [ ],
    
    /**
     * Adds a property translator for a specific class name.
     *
     * @param className the class name
     * @param propertyTranslator the property translator 
     */
    addPropertyTranslator: function(className, propertyTranslator) {
        this._propertyTranslatorMap[className] = propertyTranslator;
    },
    
    /**
     * Adds a property translator for a specific constructor.
     *
     * @param type the constructor
     * @param propertyTranslator the property translator 
     */
    addPropertyTranslatorByType: function(type, propertyTranslator) {
        this._propertyTranslatorTypeData.push(type, propertyTranslator);
    },
    
    /**
     * Retrieves a property translator for a specific class name.
     *
     * @param className the class name
     * @return the property translator
     */
    getPropertyTranslator: function(className) {
        return this._propertyTranslatorMap[className];
    },
    
    /**
     * Retrieves a property translator for a specific constructor.
     *
     * @param type the constructor
     * @return the property translator
     */
    getPropertyTranslatorByType: function(type) {
        for (var i = 0; i < this._propertyTranslatorTypeData.length; i += 2) {
            if (this._propertyTranslatorTypeData[i] == type) {
                return this._propertyTranslatorTypeData[i + 1];
            } 
        }
        return null;
    },
    
    /**
     * Deserializes an XML representation of a component into a component instance.
     * Any child components will be added to the created component instance.
     * Events properties will be registered with the client by invoking the
     * "addComponentListener()" method on the provided 'client', passing in
     * the properties 'component' (the component instance) and 'event' (the event
     * type as a string).
     * 
     * @param client the containing client
     * @param componentElement the 'c' DOM element to deserialize
     * @return the instantiated component.
     */
    loadComponent: function(client, componentElement, referenceMap) {
        if (!componentElement.nodeName == "c") {
            throw new Error("Element is not a component.");
        }
        var type = componentElement.getAttribute("t");
        var id = componentElement.getAttribute("i");
    
        var component = EchoApp.ComponentFactory.newInstance(type, id);
    
        if (componentElement.getAttribute("en") == "false") {
            component.setEnabled(false);
        }
        
        var styleName = componentElement.getAttribute("s");
        if (styleName) {
            component.setStyleName(styleName);
        }
        
        var styleData = component.getLocalStyleData();
        
        var element = componentElement.firstChild;
        while (element) {
            if (element.nodeType == 1) {
                switch (element.nodeName) {
                case "c": // Child Component
                    var childComponent = this.loadComponent(client, element, referenceMap);
                    component.add(childComponent);
                    break;
                case "p": // Property
                    this.loadProperty(client, element, component, styleData, referenceMap);
                    break;
                case "e": // Event
                    this._loadComponentEvent(client, element, component);
                    break;
                }
            }
            element = element.nextSibling;
        }
        
        return component;
    },
    
    _loadComponentEvent: function(client, eventElement, component) {
        var eventType = eventElement.getAttribute("t");
        client.addComponentListener(component, eventType);
    },
    
    /**
     * Deserializes an XML representation of a property into an instance,
     * and assigns it to the specified object.
     * 
     * @param client the containing client
     * @param {Element} propertyElement the property element to parse
     * @param object the object on which the properties should be set (this object
     *        must contain set() and setIndex() methods
     * @param styleData (optional) an associative array on which properties can
     *        be directly set
     * @param referenceMap (optional) an associative array containing previously
     *        loaded reference-based properties
     */
    loadProperty: function(client, propertyElement, object, styleData, referenceMap) {
        var propertyName = propertyElement.getAttribute("n");
        var propertyType = propertyElement.getAttribute("t");
        var propertyIndex = propertyElement.getAttribute("x");
        var propertyValue;
        
        if (propertyType) {
            // Invoke custom property processor.
            var translator = EchoSerial._propertyTranslatorMap[propertyType];
            if (!translator) {
                throw new Error("Translator not available for property type: " + propertyType);
            }
            propertyValue = translator.toProperty(client, propertyElement);
        } else {
            if (referenceMap) {
                var propertyReference = propertyElement.getAttribute("r");
                if (propertyReference) {
                    propertyValue = referenceMap[propertyReference];
                } else {
                    propertyValue = EchoSerial.PropertyTranslator.String.toProperty(client, propertyElement);
                }
            } else {
                propertyValue = EchoSerial.PropertyTranslator.String.toProperty(client, propertyElement);
            }
        }
        
        if (propertyName) {
            if (styleData) {
                if (propertyIndex == null) {
                    styleData[propertyName] = propertyValue;
                } else {
                    var indexValues = styleData[propertyName];
                    if (!indexValues) {
                        indexValues = [];
                        styleData[propertyName] = indexValues;
                    }
                    indexValues[propertyIndex] = propertyValue;
                }
            } else {
                // Property has property name: invoke set(Indexed)Property.
                if (propertyIndex == null) {
                    object.set(propertyName, propertyValue);
                } else {
                    object.setIndex(propertyName, propertyIndex, propertyValue);
                }
            }
        } else {
            // Property has method name: invoke method.
            var propertyMethod = propertyElement.getAttribute("m");
            if (propertyIndex == null) {
                object[propertyMethod](propertyValue);
            } else {
                object[propertyMethod](propertyIndex, propertyValue);
            }
        }
    },
    
    /**
     * Deserializes an XML representation of a style sheet into a
     * StyleSheet instance.
     */
    loadStyleSheet: function(client, ssElement, referenceMap) {
        var styleSheet = new EchoApp.StyleSheet();
        
        var ssChild = ssElement.firstChild;
        while (ssChild) {
            if (ssChild.nodeType == 1) {
                if (ssChild.nodeName == "s") {
                    var style = {};
                    var sChild = ssChild.firstChild;
                    while (sChild) {
                        if (sChild.nodeType == 1) {
                            switch (sChild.nodeName) {
                            case "p":
                                this.loadProperty(client, sChild, null, style, referenceMap);
                                break;
                            }
                        }
                        sChild = sChild.nextSibling;
                    }
                    styleSheet.setStyle(ssChild.getAttribute("n"), ssChild.getAttribute("t"), style);
                }
            }
            ssChild = ssChild.nextSibling;
        }
        return styleSheet;
    },
    
    /**
     * Serializes a property value into an XML representation.
     */
    storeProperty: function(client, propertyElement, propertyValue) {
        if (propertyValue == null) {
            //FIXME.  Send nulled values.
        } else if (typeof (propertyValue) == "object") {
            var translator = null;
            if (propertyValue.className) {
                translator = this._propertyTranslatorMap[propertyValue.className];
            } else {
                translator = this.getPropertyTranslatorByType(propertyValue.constructor);
            }
            
            if (!translator || !translator.toXml) {
                // If appropriate translator does not exist, or translator does not support to-XML translation,
                // simply ignore the property.
                return;
            }
            translator.toXml(client, propertyElement, propertyValue);
        } else {
            // call toString here, IE will otherwise convert boolean values to integers
            propertyElement.appendChild(propertyElement.ownerDocument.createTextNode(propertyValue.toString()));
        }
    }
};

/**
 * Namespace for property translator implementations.
 * @namespace
 */
EchoSerial.PropertyTranslator = { };

/**
 * Null PropertyTranslator Singleton.
 * @class
 */
EchoSerial.PropertyTranslator.Null = {

    toProperty: function(client, propertyElement) {
        return null;
    }
};

EchoSerial.addPropertyTranslator("0", EchoSerial.PropertyTranslator.Null);

/**
 * Boolean PropertyTranslator Singleton.
 * @class
 */
EchoSerial.PropertyTranslator.Boolean = {

    toProperty: function(client, propertyElement) {
        return propertyElement.firstChild.data == "true";
    }
};

EchoSerial.addPropertyTranslator("b", EchoSerial.PropertyTranslator.Boolean);

/**
 * Float PropertyTranslator Singleton.
 * @class
 */
EchoSerial.PropertyTranslator.Float = {

    toProperty: function(client, propertyElement) {
        return parseFloat(propertyElement.firstChild.data);
    }
};

EchoSerial.addPropertyTranslator("f", EchoSerial.PropertyTranslator.Float);

/**
 * Integer PropertyTranslator Singleton.
 * @class
 */
EchoSerial.PropertyTranslator.Integer = { 

    toProperty: function(client, propertyElement) {
        return parseInt(propertyElement.firstChild.data);
    }
};

EchoSerial.addPropertyTranslator("i", EchoSerial.PropertyTranslator.Integer);

/**
 * String PropertyTranslator Singleton.
 * @class
 */
EchoSerial.PropertyTranslator.String = {

    toProperty: function(client, propertyElement) {
        var textNode = propertyElement.firstChild;
        if (!textNode) {
            return "";
        }
        var text = textNode.data;
        while (textNode.nextSibling) {
            textNode = textNode.nextSibling;
            text += textNode.data;
        }
        return text;
    }
};

EchoSerial.addPropertyTranslator("s", EchoSerial.PropertyTranslator.String);

/**
 * Date PropertyTranslator Singleton.
 * @class
 */
EchoSerial.PropertyTranslator.Date = {

    _expr: /(\d{4})\.(\d{2}).(\d{2})/,

    toProperty: function(client, propertyElement) {
        var value = EchoSerial.PropertyTranslator.String.toProperty(client, propertyElement);
        var result = this._expr.exec(value);
        if (!result) {
            return null;
        }
        return new Date(result[1], parseInt(result[2]) - 1, result[3]);
    },
    
    toXml: function(client, propertyElement, propertyValue) {
        propertyElement.appendChild(propertyElement.ownerDocument.createTextNode(
                propertyValue.getFullYear() + "." + (propertyValue.getMonth() + 1) + "." + propertyValue.getDate()));
    }
};

EchoSerial.addPropertyTranslator("d", EchoSerial.PropertyTranslator.Date);
EchoSerial.addPropertyTranslatorByType(Date, EchoSerial.PropertyTranslator.Date);

/**
 * Map (Associative Array) PropertyTranslator Singleton.
 * @class
 */
EchoSerial.PropertyTranslator.Map = {

    toProperty: function(client, propertyElement) {
        var mapObject = {};
        var element = propertyElement.firstChild;
        while (element) {
            if (element.nodeType != 1) {
                continue;
            }
    
            EchoSerial.loadProperty(client, element, null, mapObject, null);
            element = element.nextSibling;
        }
        return mapObject;
    }
};

EchoSerial.addPropertyTranslator("m", EchoSerial.PropertyTranslator.Map);

/**
 * Alignment PropertyTranslator Singleton.
 * @class
 */
EchoSerial.PropertyTranslator.Alignment = {

    _HORIZONTAL_MAP: {
        "leading": "leading",
        "trailing": "trailing",
        "left": "left",
        "center": "center",
        "right": "right"
    },
    
    _VERTICAL_MAP: {
        "top": "top",
        "center": "middle",
        "bottom": "bottom"
    },

    toProperty: function(client, propertyElement) {
        var element = WebCore.DOM.getChildElementByTagName(propertyElement, "a");
        var h = this._HORIZONTAL_MAP[element.getAttribute("h")];
        var v = this._VERTICAL_MAP[element.getAttribute("v")];
        
        if (h) {
            if (v) {
                return { horizontal: h, vertical: v };
            }
            return h;
        }
        if (v) {
            return v;
        }
        return null;
    }
};

EchoSerial.addPropertyTranslator("Alignment", EchoSerial.PropertyTranslator.Alignment);
EchoSerial.addPropertyTranslator("AL", EchoSerial.PropertyTranslator.Alignment);

/**
 * Border PropertyTranslator Singleton.
 * @class
 */
EchoSerial.PropertyTranslator.Border = {

    toProperty: function(client, propertyElement) {
        var value = propertyElement.getAttribute("v");
        if (value) {
            return value;
        } else {
            var element = WebCore.DOM.getChildElementByTagName(propertyElement, "b");
            var border = {};
            
            value = element.getAttribute("t");
            if (value) {
                border.top = value;
                value = element.getAttribute("r");
                if (value) {
                    border.right = value;
                    value = element.getAttribute("b");
                    if (value) {
                        border.bottom = value;
                        value = element.getAttribute("l");
                        if (value) {
                            border.left = value;
                        }
                    }
                }
            } else {
                throw new Error("Invalid multi-sided border: no sides set.");
            }
            return border;
        }
    }
};

EchoSerial.addPropertyTranslator("Border", EchoSerial.PropertyTranslator.Border);
EchoSerial.addPropertyTranslator("BO", EchoSerial.PropertyTranslator.Border);

//FIXME delete
/**
 * Extent PropertyTranslator Singleton.
 * @class
 */
EchoSerial.PropertyTranslator.Extent = {

    toProperty: function(client, propertyElement) {
        return  propertyElement.firstChild.data;
    },
    
    toXml: function(client, propertyElement, propertyValue) {
        propertyElement.appendChild(propertyElement.ownerDocument.createTextNode(propertyValue.toString()));
    }
};

EchoSerial.addPropertyTranslator("Extent", EchoSerial.PropertyTranslator.Extent);
EchoSerial.addPropertyTranslator("X", EchoSerial.PropertyTranslator.Extent);

/**
 * FillImage PropertyTranslator Singleton.
 * @class
 */
EchoSerial.PropertyTranslator.FillImage = {

    toProperty: function(client, propertyElement) {
        var element = WebCore.DOM.getChildElementByTagName(propertyElement, "fi");
        return this._parseElement(client, element);
    },
    
    _parseElement: function(client, fiElement) {
        var url = fiElement.getAttribute("u");
        if (client.decompressUrl) {
            url = client.decompressUrl(url);
        }
        repeat = fiElement.getAttribute("r");
        var x = fiElement.getAttribute("x");
        var y = fiElement.getAttribute("y");
        
        if (repeat || x || y) {
            return { url: url, repeat: repeat, x: x, y: y };
        } else {
            return url;
        }
    }
};

EchoSerial.addPropertyTranslator("FillImage", EchoSerial.PropertyTranslator.FillImage);
EchoSerial.addPropertyTranslator("FI", EchoSerial.PropertyTranslator.FillImage);

/**
 * FillImageBorder PropertyTranslator Singleton.
 * @class
 */
EchoSerial.PropertyTranslator.FillImageBorder = {

    _NAMES: [ "topLeft", "top", "topRight", "left", "right", "bottomLeft", "bottom", "bottomRight" ],

    toProperty: function(client, propertyElement) {
        var element = WebCore.DOM.getChildElementByTagName(propertyElement, "fib");
        return EchoSerial.PropertyTranslator.FillImageBorder._parseElement(client, element);
    },
    
    _parseElement: function(client, fibElement) {
        var fillImageBorder = { 
            contentInsets: fibElement.getAttribute("ci") == "" ? null : fibElement.getAttribute("ci"),
            borderInsets: fibElement.getAttribute("bi") == "" ? null : fibElement.getAttribute("bi"),
            color: fibElement.getAttribute("bc")
        };
        
        var element = fibElement.firstChild;
        var i = 0;
        while(element) {
            if (element.nodeType == 1) {
                if (element.nodeName == "fi") {
                    fillImageBorder[this._NAMES[i]] = EchoSerial.PropertyTranslator.FillImage._parseElement(client, element);
                    ++i;
                } else if (element.nodeName == "null-fi") {
                    ++i;
                }
            }
            element = element.nextSibling;
        }
        if (!(i == 0 || i == 8)) {
            throw new Error("Invalid FillImageBorder image count: " + i);
        }
    
        return fillImageBorder;
    }
};

EchoSerial.addPropertyTranslator("FillImageBorder", EchoSerial.PropertyTranslator.FillImageBorder);
EchoSerial.addPropertyTranslator("FIB", EchoSerial.PropertyTranslator.FillImageBorder);

/**
 * Font PropertyTranslator Singleton.
 * @class
 */
EchoSerial.PropertyTranslator.Font = {

    toProperty: function(client, propertyElement) {
        var element = WebCore.DOM.getChildElementByTagName(propertyElement, "f");
        var tfElements = WebCore.DOM.getChildElementsByTagName(element, "tf");
        
        var font = { };
        
        if (tfElements.length > 1) {
            font.typeface = new Array(tfElements.length);
            for (var i = 0; i < tfElements.length; ++i) {
                font.typeface[i] = tfElements[i].getAttribute("n");
            }
        } else if (tfElements.length == 1) {
            font.typeface = tfElements[0].getAttribute("n");
        }
        
        var size = element.getAttribute("sz");
        if (size) {
            font.size = size;
        }
        
        if (element.getAttribute("bo")) { font.bold        = true; }
        if (element.getAttribute("it")) { font.italic      = true; }
        if (element.getAttribute("un")) { font.underline   = true; }
        if (element.getAttribute("ov")) { font.overline    = true; }
        if (element.getAttribute("lt")) { font.lineThrough = true; }
        
        return font;
    }
};

EchoSerial.addPropertyTranslator("Font", EchoSerial.PropertyTranslator.Font);
EchoSerial.addPropertyTranslator("F", EchoSerial.PropertyTranslator.Font);

/**
 * ImageReference PropertyTranslator Singleton.
 * @class
 */
EchoSerial.PropertyTranslator.ImageReference = {

    toProperty: function(client, propertyElement) {
        var url = propertyElement.firstChild.data;
        if (client.decompressUrl) {
            url = client.decompressUrl(url);
        }
        var width = propertyElement.getAttribute("w");
        width = width ? width : null;
        var height = propertyElement.getAttribute("h");
        height = height ? height : null;
        
        if (width || height) {
            return { url: url, width: width, height: height };
        } else {
            return url;
        }
    }
};

EchoSerial.addPropertyTranslator("ImageReference", EchoSerial.PropertyTranslator.ImageReference);
EchoSerial.addPropertyTranslator("I", EchoSerial.PropertyTranslator.ImageReference);

/**
 * Insets PropertyTranslator Singleton.
 * @class
 */
EchoSerial.PropertyTranslator.Insets = {

    toProperty: function(client, propertyElement) {
        return propertyElement.firstChild.data;
    }
};

EchoSerial.addPropertyTranslator("Insets", EchoSerial.PropertyTranslator.Insets);
EchoSerial.addPropertyTranslator("N", EchoSerial.PropertyTranslator.Insets);

/**
 * LayoutData PropertyTranslator Singleton.
 * @class
 */
EchoSerial.PropertyTranslator.LayoutData = {

    toProperty: function(client, propertyElement) {
        var layoutData = {};
        var element = propertyElement.firstChild;
        while (element) {
            if (element.nodeType == 1) {
                switch (element.nodeName) {
                case "p":
                    EchoSerial.loadProperty(client, element, null, layoutData);
                    break;
                }
            }
            element = element.nextSibling;
        }
        return layoutData;
    }
};

EchoSerial.addPropertyTranslator("LayoutData", EchoSerial.PropertyTranslator.LayoutData);
EchoSerial.addPropertyTranslator("L", EchoSerial.PropertyTranslator.LayoutData);
