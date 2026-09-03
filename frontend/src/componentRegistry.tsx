import React from "react";
import Navbar from "./Component/Navbar";
import ProductGrid from "./Component/ProductGrid";
import ProductDetail from "./Component/ProductDetail";
import CartSidebar from "./Component/CartSidebar";
import Footer from "./Component/Footer";
import AdminSidebar from "./Component/AdminSidebar";
import { FilterSidebar } from "./Component/FilterSidebar";
import { Pagination } from "./Component/Pagination";
import { CheckoutCta } from "./Component/CheckoutCta";
import { DeliveryForm } from "./Component/DeliveryForm";
import { PaymentMethods } from "./Component/PaymentMethods";
import { PlaceOrderCta } from "./Component/PlaceOrderCta";
import CustomerProfilePage from "./pages/CustomerProfilePage";
import CustomerLoginPage from "./pages/CustomerLoginPage";
import CustomerSignupPage from "./pages/CustomerSignupPage";
import { HeroBanner } from "./Component/HeroBanner";
import { ProductCarousel } from "./Component/ProductCarousel";
import { BrandStoreGrid } from "./Component/BrandStoreGrid";
import { CategoryGrid } from "./Component/CategoryGrid";
import { SectionGroupCarousel } from "./Component/SectionGroupCarousel";

export type ComponentRegistry = Record<string, React.ComponentType<any>>;

export const componentRegistry: ComponentRegistry = {
  navbar: Navbar,
  footer: Footer,

  product_grid: ProductGrid,
  productgrid: ProductGrid,

  product_carousel: ProductCarousel,
  productcarousel: ProductCarousel,

  section_group_carousel: SectionGroupCarousel,
  sectiongroupcarousel: SectionGroupCarousel,
  category_story_carousel: SectionGroupCarousel,

  brand_store_grid: BrandStoreGrid,
  brandstoregrid: BrandStoreGrid,

  category_grid: CategoryGrid,
  categorygrid: CategoryGrid,

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
  cart_view: CartSidebar,
  cartview: CartSidebar,
  cart: CartSidebar,
  order_summary: CartSidebar,
  ordersummary: CartSidebar,

  admin_sidebar: AdminSidebar,
  adminsidebar: AdminSidebar,

  hero_banner: HeroBanner,
  herobanner: HeroBanner,

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

  profile_details: CustomerProfilePage,
  profiledetails: CustomerProfilePage,
  profile: CustomerProfilePage,
  customer_profile: CustomerProfilePage,
  customerprofile: CustomerProfilePage,

  signin_form: CustomerLoginPage,
  signinform: CustomerLoginPage,
  login_form: CustomerLoginPage,
  loginform: CustomerLoginPage,
  login: CustomerLoginPage,

  signup_form: CustomerSignupPage,
  signupform: CustomerSignupPage,
  register_form: CustomerSignupPage,
  registerform: CustomerSignupPage,
  signup: CustomerSignupPage,
};

export default componentRegistry;