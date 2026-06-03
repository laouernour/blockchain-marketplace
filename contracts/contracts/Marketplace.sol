// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Marketplace {
    address public admin;

    uint256 public storeCount;
    uint256 public productCount;
    uint256 public orderCount;

    uint256 public constant DELIVERY_TIMEOUT = 7 days;
    uint256 public constant DISPUTE_WINDOW   = 48 hours;

    struct Store {
        uint256 id;
        address owner;
        string name;
        string ipfsHash;
        bool exists;
    }

    struct Product {
        uint256 id;
        uint256 storeId;
        address seller;
        uint256 price;
        uint256 stock;
        string ipfsHash;
        bool exists;
    }

    struct Order {
        uint256 id;
        uint256 productId;
        address buyer;
        address deliverer;
        uint256 amount;
        bool delivered;
        bool released;
        bool disputed;
        bool disputeResolved;
        bool buyerWon;
        uint256 deliveryTimestamp;
        string disputeIpfsHash;
        bool exists;
    }

    struct Review {
        uint256 id;
        uint256 orderId;
        uint256 productId;
        address reviewer;
        uint8 rating;
        string ipfsHash;
        bool exists;
    }

    mapping(uint256 => Store)   public stores;
    mapping(address => uint256) public storeOfOwner;

    mapping(uint256 => Product)   public products;
    mapping(uint256 => uint256[]) public productIdsByStore;

    mapping(uint256 => Order)     public orders;
    mapping(uint256 => uint256)   public orderTimestamp;
    mapping(address => uint256[]) public orderIdsByBuyer;
    mapping(address => uint256[]) public orderIdsBySeller;
    mapping(address => uint256[]) public orderIdsByDeliverer;
    mapping(address => bool)     public isDeliverer;

    mapping(uint256 => Review[]) public reviewsByProduct;
    mapping(uint256 => bool)     public reviewedOrder;

    mapping(uint256 => uint256) public totalRatingByProduct;
    mapping(uint256 => uint256) public ratingCountByProduct;

    event StoreCreated(uint256 indexed storeId, address indexed owner, string name, string ipfsHash);
    event ProductAdded(uint256 indexed productId, uint256 indexed storeId, address indexed seller, uint256 price, uint256 stock, string ipfsHash);
    event OrderCreated(uint256 indexed orderId, uint256 indexed productId, address indexed buyer, uint256 amount);
    event DeliveryConfirmed(uint256 indexed orderId, uint256 indexed productId, address indexed buyer);
    event FundsReleased(uint256 indexed orderId, address indexed seller, uint256 amount);
    event RefundClaimed(uint256 indexed orderId, address indexed buyer, uint256 amount);
    event DelivererAssigned(uint256 indexed orderId, address indexed deliverer);
    event DisputeOpened(uint256 indexed orderId, address indexed buyer, string ipfsHash);
    event DisputeResolved(uint256 indexed orderId, bool favorBuyer);
    event ReviewSubmitted(uint256 indexed reviewId, uint256 indexed productId, address indexed reviewer, uint8 rating, string ipfsHash);

    constructor() {
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    modifier onlyExistingStoreOwner() {
        require(storeOfOwner[msg.sender] != 0, "Create store first");
        _;
    }

    // ─── Boutique ────────────────────────────────────────────────────────────

    function createStore(string calldata _name, string calldata _ipfsHash) external {
        require(bytes(_name).length > 0, "Store name required");
        require(storeOfOwner[msg.sender] == 0, "Store already exists");
        require(!isDeliverer[msg.sender], "Deliverers cannot create stores");

        storeCount++;
        stores[storeCount] = Store({ id: storeCount, owner: msg.sender, name: _name, ipfsHash: _ipfsHash, exists: true });
        storeOfOwner[msg.sender] = storeCount;

        emit StoreCreated(storeCount, msg.sender, _name, _ipfsHash);
    }

    // ─── Produit ─────────────────────────────────────────────────────────────

    function addProduct(uint256 _price, uint256 _stock, string calldata _ipfsHash) external onlyExistingStoreOwner {
        require(_price > 0, "Price must be > 0");
        require(_stock > 0, "Stock must be > 0");

        uint256 storeId = storeOfOwner[msg.sender];
        productCount++;

        products[productCount] = Product({
            id: productCount,
            storeId: storeId,
            seller: msg.sender,
            price: _price,
            stock: _stock,
            ipfsHash: _ipfsHash,
            exists: true
        });
        productIdsByStore[storeId].push(productCount);

        emit ProductAdded(productCount, storeId, msg.sender, _price, _stock, _ipfsHash);
    }

    // ─── Achat ───────────────────────────────────────────────────────────────

    function purchase(uint256 _productId) external payable {
        Product storage p = products[_productId];

        require(p.exists, "Product not found");
        require(p.stock > 0, "Out of stock");
        require(msg.value == p.price, "Incorrect price");
        require(msg.sender != p.seller, "Seller cannot buy own product");
        require(!isDeliverer[msg.sender], "Deliverers cannot buy products");

        p.stock--;
        orderCount++;

        orders[orderCount] = Order({
            id: orderCount,
            productId: _productId,
            buyer: msg.sender,
            deliverer: address(0),
            amount: msg.value,
            delivered: false,
            released: false,
            disputed: false,
            disputeResolved: false,
            buyerWon: false,
            deliveryTimestamp: 0,
            disputeIpfsHash: "",
            exists: true
        });
        orderTimestamp[orderCount] = block.timestamp;

        orderIdsByBuyer[msg.sender].push(orderCount);
        orderIdsBySeller[p.seller].push(orderCount);

        emit OrderCreated(orderCount, _productId, msg.sender, msg.value);
    }

    // ─── Assigner un livreur (vendeur uniquement) ─────────────────────────────

    function assignDeliverer(uint256 _orderId, address _deliverer) external {
        Order storage o = orders[_orderId];
        Product storage p = products[o.productId];

        require(o.exists, "Order not found");
        require(msg.sender == p.seller, "Only seller can assign deliverer");
        require(!o.delivered, "Already delivered");
        require(!o.released, "Funds already released");
        require(_deliverer != address(0), "Invalid deliverer address");
        require(_deliverer != o.buyer, "Buyer cannot be deliverer");
        require(_deliverer != p.seller, "Seller cannot be deliverer");

        o.deliverer = _deliverer;
        orderIdsByDeliverer[_deliverer].push(_orderId);
        isDeliverer[_deliverer] = true;

        emit DelivererAssigned(_orderId, _deliverer);
    }

    // ─── Confirmation livraison (livreur uniquement) ──────────────────────────

    function confirmDelivery(uint256 _orderId) external {
        Order storage o = orders[_orderId];

        require(o.exists, "Order not found");
        require(o.deliverer != address(0), "No deliverer assigned yet");
        require(msg.sender == o.deliverer, "Only assigned deliverer can confirm");
        require(!o.delivered, "Already confirmed");
        require(!o.released, "Funds already released");

        o.delivered = true;
        o.deliveryTimestamp = block.timestamp;

        emit DeliveryConfirmed(_orderId, o.productId, msg.sender);
    }

    // ─── Libérer les fonds (après 48h sans litige) ────────────────────────────

    function releaseFunds(uint256 _orderId) external {
        Order storage o = orders[_orderId];

        require(o.exists, "Order not found");
        require(o.delivered, "Delivery not confirmed");
        require(!o.released, "Funds already released");
        require(!o.disputed, "Order is disputed");
        require(
            block.timestamp >= o.deliveryTimestamp + DISPUTE_WINDOW,
            "Dispute window still open (48h)"
        );

        o.released = true;

        Product storage p = products[o.productId];
        (bool ok, ) = payable(p.seller).call{value: o.amount}("");
        require(ok, "Transfer failed");

        emit FundsReleased(_orderId, p.seller, o.amount);
    }

    // ─── Ouvrir un litige (acheteur, dans les 48h après confirmation) ─────────

    function openDispute(uint256 _orderId, string calldata _ipfsHash) external {
        Order storage o = orders[_orderId];

        require(o.exists, "Order not found");
        require(msg.sender == o.buyer, "Only buyer can dispute");
        require(o.delivered, "Delivery not confirmed yet");
        require(!o.released, "Funds already released");
        require(!o.disputed, "Already disputed");
        require(
            block.timestamp < o.deliveryTimestamp + DISPUTE_WINDOW,
            "Dispute window closed (48h passed)"
        );

        o.disputed = true;
        o.disputeIpfsHash = _ipfsHash;

        emit DisputeOpened(_orderId, msg.sender, _ipfsHash);
    }

    // ─── Résoudre un litige (admin uniquement) ────────────────────────────────

    function resolveDispute(uint256 _orderId, bool _favorBuyer) external onlyAdmin {
        Order storage o = orders[_orderId];

        require(o.exists, "Order not found");
        require(o.disputed, "No dispute on this order");
        require(!o.released, "Funds already released");

        o.released = true;
        o.disputed = false;
        o.disputeResolved = true;
        o.buyerWon = _favorBuyer;

        if (_favorBuyer) {
            // Remboursement acheteur + restitution stock
            Product storage p = products[o.productId];
            if (p.exists) p.stock++;
            (bool ok, ) = payable(o.buyer).call{value: o.amount}("");
            require(ok, "Refund failed");
        } else {
            // Paiement vendeur
            Product storage p = products[o.productId];
            (bool ok, ) = payable(p.seller).call{value: o.amount}("");
            require(ok, "Transfer failed");
        }

        emit DisputeResolved(_orderId, _favorBuyer);
    }

    // ─── Remboursement (7 jours sans livraison) ───────────────────────────────

    function claimRefund(uint256 _orderId) external {
        Order storage o = orders[_orderId];

        require(o.exists, "Order not found");
        require(msg.sender == o.buyer, "Only buyer can claim refund");
        require(!o.delivered, "Already delivered");
        require(!o.released, "Funds already released");
        require(
            block.timestamp >= orderTimestamp[_orderId] + DELIVERY_TIMEOUT,
            "Refund available 7 days after purchase"
        );

        o.released = true;

        Product storage p = products[o.productId];
        if (p.exists) p.stock++;

        (bool ok, ) = payable(o.buyer).call{value: o.amount}("");
        require(ok, "Refund failed");

        emit RefundClaimed(_orderId, o.buyer, o.amount);
    }

    // ─── Avis ─────────────────────────────────────────────────────────────────

    function submitReview(uint256 _orderId, uint8 _rating, string calldata _ipfsHash) external {
        Order storage o = orders[_orderId];

        require(o.exists, "Order not found");
        require(msg.sender == o.buyer, "Only buyer can review");
        require(o.delivered, "Delivery not confirmed");
        require(!reviewedOrder[_orderId], "Already reviewed");
        require(_rating >= 1 && _rating <= 5, "Rating must be 1..5");

        reviewedOrder[_orderId] = true;

        uint256 productId = o.productId;
        uint256 reviewId = reviewsByProduct[productId].length + 1;

        reviewsByProduct[productId].push(Review({
            id: reviewId,
            orderId: _orderId,
            productId: productId,
            reviewer: msg.sender,
            rating: _rating,
            ipfsHash: _ipfsHash,
            exists: true
        }));

        totalRatingByProduct[productId] += _rating;
        ratingCountByProduct[productId] += 1;

        emit ReviewSubmitted(reviewId, productId, msg.sender, _rating, _ipfsHash);
    }

    // ─── Vues ─────────────────────────────────────────────────────────────────

    function getAverageRating(uint256 _productId) external view returns (uint256) {
        uint256 count = ratingCountByProduct[_productId];
        if (count == 0) return 0;
        return totalRatingByProduct[_productId] / count;
    }

    function getReviewsCount(uint256 _productId) external view returns (uint256) {
        return reviewsByProduct[_productId].length;
    }

    function getReview(uint256 _productId, uint256 _index) external view returns (
        uint256 id, uint256 orderId, uint256 productId,
        address reviewer, uint8 rating, string memory ipfsHash, bool exists
    ) {
        Review memory r = reviewsByProduct[_productId][_index];
        return (r.id, r.orderId, r.productId, r.reviewer, r.rating, r.ipfsHash, r.exists);
    }

    function getOrderIdsByBuyer(address _buyer) external view returns (uint256[] memory) {
        return orderIdsByBuyer[_buyer];
    }

    function getOrderIdsBySeller(address _seller) external view returns (uint256[] memory) {
        return orderIdsBySeller[_seller];
    }

    function getOrderIdsByDeliverer(address _deliverer) external view returns (uint256[] memory) {
        return orderIdsByDeliverer[_deliverer];
    }

    function getProductIdsByStore(uint256 _storeId) external view returns (uint256[] memory) {
        return productIdsByStore[_storeId];
    }
}
