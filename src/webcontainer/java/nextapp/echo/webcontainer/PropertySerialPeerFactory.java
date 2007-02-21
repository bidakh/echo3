package nextapp.echo.webcontainer;

import nextapp.echo.app.util.PeerFactory;
import nextapp.echo.app.xml.XmlPropertyPeer;

//FIXME.  This is a temporary class to be used in refactoring the peer stuff between app and webcontaienr.
// this code will be exterminated.

public class PropertySerialPeerFactory {

    private static final String RESOURCE_NAME = "META-INF/nextapp/echo/SynchronizePeerBindings.properties";
    private static final PeerFactory peerFactory 
            = new PeerFactory(RESOURCE_NAME, Thread.currentThread().getContextClassLoader());

    public static final PropertySerialPeerFactory INSTANCE = new PropertySerialPeerFactory();
    
    /**
     * Retrieves the appropriate <code>PropertySynchronizePeer</code> for a given 
     * property class.
     * 
     * @param propertyClass the property class
     * @return the appropriate <code>PropertySynchronizePeer</code>
     */
    public XmlPropertyPeer getPeerForProperty(Class propertyClass) {
        return (XmlPropertyPeer) peerFactory.getPeerForObject(propertyClass, true);
    }
}
