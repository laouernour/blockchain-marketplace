// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Marketplace {
    uint256 public storeCount;
    uint256 public productCount;
    uint256 public orderCount;

    struct Store {
        uint256 id;
        address owner;
        string name;
        string ipfsHash; // logo / metadata IPFS
        bool exists;
    }

    struct Product {
        uint256 id;
        uint256 storeId;
        address seller;
        uint256 price;
        uint256 stock;
        string ipfsHash; // image / metadata IPFS
        bool exists;
    }

    struct Order {
        uint256 id;
        uint256 productId;
        address buyer;
        uint256 amount;
        bool delivered;
        bool released;
        bool exists;
    }

    struct Review {
        uint256 id;
        uint256 orderId;
        uint256 productId;
        address reviewer;
        uint8 rating;
        string ipfsHash; // commentaire IPFS
        bool exists;
    }

    mapping(uint256 => Store) public stores;
    mapping(address => uint256) public storeOfOwner;

    mapping(uint256 => Product) public products;
    mapping(uint256 => uint256[]) public productIdsByStore;

    mapping(uint256 => Order) public orders;
    mapping(address => uint256[]) public orderIdsByBuyer;
    mapping(address => uint256[]) public orderIdsBySeller;

    mapping(uint256 => Review[]) public reviewsByProduct;
    mapping(uint256 => bool) public reviewedOrder;

    mapping(uint256 => uint256) public totalRatingByProduct;
    mapping(uint256 => uint256) public ratingCountByProduct;

    event StoreCreated(
        uint256 indexed storeId,
        address indexed owner,
        string name,
        string ipfsHash
    );

    event ProductAdded(
        uint256 indexed productId,
        uint256 indexed storeId,
        address indexed seller,
        uint256 price,
        uint256 stock,
        string ipfsHash
    );

    event OrderCreated(
        uint256 indexed orderId,
        uint256 indexed productId,
        address indexed buyer,
        uint256 amount
    );

    event DeliveryConfirmed(
        uint256 indexed orderId,
        uint256 indexed productId,
        address indexed buyer
    );

    event ReviewSubmitted(
        uint256 indexed reviewId,
        uint256 indexed productId,
        address indexed reviewer,
        uint8 rating,
        string ipfsHash
    );

    modifier onlyExistingStoreOwner() {
        require(storeOfOwner[msg.sender] != 0, "Create store first");
        _;
    }

    function createStore(
        string calldata _name,
        string calldata _ipfsHash
    ) external {
        require(bytes(_name).length > 0, "Store name required");
        require(storeOfOwner[msg.sender] == 0, "Store already exists");

        storeCount++;

        stores[storeCount] = Store({
            id: storeCount,
            owner: msg.sender,
            name: _name,
            ipfsHash: _ipfsHash,
            exists: true
        });

        storeOfOwner[msg.sender] = storeCount;

        emit StoreCreated(storeCount, msg.sender, _name, _ipfsHash);
    }

    function addProduct(
        uint256 _price,
        uint256 _stock,
        string calldata _ipfsHash
    ) external onlyExistingStoreOwner {
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

        emit ProductAdded(
            productCount,
            storeId,
            msg.sender,
            _price,
            _stock,
            _ipfsHash
        );
    }

    function purchase(uint256 _productId) external payable {
        Product storage p = products[_productId];

        require(p.exists, "Product not found");
        require(p.stock > 0, "Out of stock");
        require(msg.value == p.price, "Incorrect price");
        require(msg.sender != p.seller, "Seller cannot buy own product");

        p.stock--;

        orderCount++;

        orders[orderCount] = Order({
            id: orderCount,
            productId: _productId,
            buyer: msg.sender,
            amount: msg.value,
            delivered: false,
            released: false,
            exists: true
        });

        orderIdsByBuyer[msg.sender].push(orderCount);
        orderIdsBySeller[p.seller].push(orderCount);

        emit OrderCreated(orderCount, _productId, msg.sender, msg.value);
    }

    function confirmDelivery(uint256 _orderId) external {
        Order storage o = orders[_orderId];

        require(o.exists, "Order not found");
        require(msg.sender == o.buyer, "Only buyer can confirm");
        require(!o.released, "Funds already released");

        Product storage p = products[o.productId];
        require(p.exists, "Product not found");

        o.delivered = true;
        o.released = true;

        (bool ok, ) = payable(p.seller).call{value: o.amount}("");
        require(ok, "Transfer failed");

        emit DeliveryConfirmed(_orderId, o.productId, msg.sender);
    }

    function submitReview(
        uint256 _orderId,
        uint8 _rating,
        string calldata _ipfsHash
    ) external {
        Order storage o = orders[_orderId];

        require(o.exists, "Order not found");
        require(msg.sender == o.buyer, "Only buyer can review");
        require(o.delivered, "Delivery not confirmed");
        require(!reviewedOrder[_orderId], "Already reviewed");
        require(_rating >= 1 && _rating <= 5, "Rating must be 1..5");

        reviewedOrder[_orderId] = true;

        uint256 productId = o.productId;
        uint256 reviewId = reviewsByProduct[productId].length + 1;

        reviewsByProduct[productId].push(
            Review({
                id: reviewId,
                orderId: _orderId,
                productId: productId,
                reviewer: msg.sender,
                rating: _rating,
                ipfsHash: _ipfsHash,
                exists: true
            })
        );

        totalRatingByProduct[productId] += _rating;
        ratingCountByProduct[productId] += 1;

        emit ReviewSubmitted(
            reviewId,
            productId,
            msg.sender,
            _rating,
            _ipfsHash
        );
    }

    function getReviewsCount(uint256 _productId) external view returns (uint256) {
        return reviewsByProduct[_productId].length;
    }

    function getAverageRating(uint256 _productId) external view returns (uint256) {
        uint256 count = ratingCountByProduct[_productId];
        if (count == 0) {
            return 0;
        }
        return totalRatingByProduct[_productId] / count;
    }

    function getStoreProductCount(uint256 _storeId) external view returns (uint256) {
        return productIdsByStore[_storeId].length;
    }

    function getBuyerOrderCount(address _buyer) external view returns (uint256) {
        return orderIdsByBuyer[_buyer].length;
    }

    function getSellerOrderCount(address _seller) external view returns (uint256) {
        return orderIdsBySeller[_seller].length;
    }

    function getProductIdsByStore(uint256 _storeId) external view returns (uint256[] memory) {
        return productIdsByStore[_storeId];
    }

    function getOrderIdsByBuyer(address _buyer) external view returns (uint256[] memory) {
        return orderIdsByBuyer[_buyer];
    }

    function getOrderIdsBySeller(address _seller) external view returns (uint256[] memory) {
        return orderIdsBySeller[_seller];
    }

    function getReview(
        uint256 _productId,
        uint256 _index
    )
        external
        view
        returns (
            uint256 id,
            uint256 orderId,
            uint256 productId,
            address reviewer,
            uint8 rating,
            string memory ipfsHash,
            bool exists
        )
    {
        Review memory r = reviewsByProduct[_productId][_index];
        return (
            r.id,
            r.orderId,
            r.productId,
            r.reviewer,
            r.rating,
            r.ipfsHash,
            r.exists
        );
    }
}