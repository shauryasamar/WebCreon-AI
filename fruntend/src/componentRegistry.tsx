import React from "react";
import Navbar from "./Component/Navbar";
import ProductGrid from "./Component/ProductGrid";
import ProductDetail from "./Component/ProductDetail";
import CartSidebar from "./Component/CartSidebar";
// import CheckoutForm from "./Component/CheckoutForm";
import Footer from "./Component/Footer";
import AdminSidebar from "./Component/AdminSidebar";
// import { CategoryGrid } from "./Component/CategoryGrid";
// import { PageHeader } from "./Component/PageHeader";
import { FilterSidebar } from "./Component/FilterSidebar";
// import FilterSidebar from "./Component/FilterSidebar";
import { Pagination } from "./Component/Pagination";
import { CheckoutCta } from "./Component/CheckoutCta";
import { DeliveryForm } from "./Component/DeliveryForm";
import { PaymentMethods } from "./Component/PaymentMethods";
import { PlaceOrderCta } from "./Component/PlaceOrderCta";
// import { OrderSummary } from "./Component/OrderSummary";
// import { PromoCodeInput } from "./Component/PromoCodeInput";
import { HeroBanner } from "./Component/HeroBanner";

export type ComponentRegistry = Record<string, React.ComponentType<any>>;

export const componentRegistry: ComponentRegistry = {
  navbar: Navbar,
  footer: Footer,

  product_grid: ProductGrid,
  productgrid: ProductGrid,

  product_detail: ProductDetail,
  productdetail: ProductDetail,
  product_info: ProductDetail,
  productinfo: ProductDetail,
  product_gallery: ProductDetail,
  productgallery: ProductDetail,
  purchase_panel: ProductDetail,
  purchasepanel: ProductDetail,

  cart_sidebar: CartSidebar,
  cartsidebar: CartSidebar,
  cart_items: CartSidebar,
  cartitems: CartSidebar,
  order_summary: CartSidebar,
  ordersummary: CartSidebar,

  // checkout_form: CheckoutForm,
  // checkoutform: CheckoutForm,

  // promo_code_input: PromoCodeInput,
  // promocodeinput: PromoCodeInput,

  admin_sidebar: AdminSidebar,
  adminsidebar: AdminSidebar,

  hero_banner: HeroBanner,
  herobanner: HeroBanner,

//   category_grid: CategoryGrid,
//   categorygrid: CategoryGrid,

//   offer_cards: ProductGrid,
//   offercards: ProductGrid,

  // order_summary: OrderSummary,
  // ordersummary: OrderSummary,

//   page_header: PageHeader,
//   pageheader: PageHeader,

  filter_sidebar: FilterSidebar,
  filtersidebar: FilterSidebar,

  pagination: Pagination,

  checkout_cta: CheckoutCta,
  checkoutcta: CheckoutCta,

  delivery_form: DeliveryForm,
  deliveryform: DeliveryForm,

  payment_methods: PaymentMethods,
  paymentmethods: PaymentMethods,

  place_order_cta: PlaceOrderCta,
  placeordercta: PlaceOrderCta,
};