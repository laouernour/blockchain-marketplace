// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Marketplace {
    uint256 public productCount;
    uint256 public orderCount;

    struct Product {
        uint256 id;
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
        uint256 amount;
        bool delivered;
        bool released;
        bool exists;
    }

    struct Review {
        uint256 productId;
        address reviewer;
        uint8 rating;
        string ipfsHash;
    }

    mapping(uint256 => Product) public products;
    mapping(uint256 => Order) public orders;
    mapping(uint256 => Review[]) public reviewsByProduct;
    mapping(uint256 => bool) public reviewedOrder;

    event ProductAdded(uint256 indexed productId, address indexed seller, uint256 price, uint256 stock);
    event Purchased(uint256 indexed orderId, uint256 indexed productId, address indexed buyer, uint256 amount);
    event DeliveryConfirmed(uint256 indexed orderId);
    event ReviewSubmitted(uint256 indexed productId, address indexed reviewer, uint8 rating);

    function addProduct(uint256 _price, uint256 _stock, string calldata _ipfsHash) external {
        require(_price > 0, "Price must be > 0");
        require(_stock > 0, "Stock must be > 0");

        productCount++;
        products[productCount] = Product({
            id: productCount,
            seller: msg.sender,
            price: _price,
            stock: _stock,
            ipfsHash: _ipfsHash,
            exists: true
        });

        emit ProductAdded(productCount, msg.sender, _price, _stock);
    }

    function purchase(uint256 _productId) external payable {
        Product storage p = products[_productId];
        require(p.exists, "Product not found");
        require(p.stock > 0, "Out of stock");
        require(msg.value == p.price, "Incorrect price");

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

        emit Purchased(orderCount, _productId, msg.sender, msg.value);
    }

    function confirmDelivery(uint256 _orderId) external {
        Order storage o = orders[_orderId];
        require(o.exists, "Order not found");
        require(msg.sender == o.buyer, "Only buyer can confirm");
        require(!o.released, "Already released");

        Product storage p = products[o.productId];

        o.delivered = true;
        o.released = true;

        (bool ok, ) = payable(p.seller).call{value: o.amount}("");
        require(ok, "Transfer failed");

        emit DeliveryConfirmed(_orderId);
    }

    function submitReview(uint256 _orderId, uint8 _rating, string calldata _ipfsHash) external {
        Order storage o = orders[_orderId];
        require(o.exists, "Order not found");
        require(msg.sender == o.buyer, "Only buyer can review");
        require(o.delivered, "Delivery not confirmed");
        require(!reviewedOrder[_orderId], "Already reviewed");
        require(_rating >= 1 && _rating <= 5, "Rating must be 1..5");

        reviewedOrder[_orderId] = true;

        uint256 productId = o.productId;
        reviewsByProduct[productId].push(Review({
            productId: productId,
            reviewer: msg.sender,
            rating: _rating,
            ipfsHash: _ipfsHash
        }));

        emit ReviewSubmitted(productId, msg.sender, _rating);
    }

    function getReviewsCount(uint256 _productId) external view returns (uint256) {
        return reviewsByProduct[_productId].length;
    }
}